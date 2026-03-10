import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-functions/v2/storage', () => ({
    onObjectFinalized: vi.fn(
        (handler: (event: { data: Record<string, unknown> }) => Promise<void>) => handler,
    ),
}));

// --- Storage mock ---
const mockDownload = vi.fn();
const mockUpload = vi.fn();
const mockGetSignedUrl = vi.fn();
const mockStorageFile = vi.fn((path: string) => ({
    path,
    download: mockDownload,
    getSignedUrl: mockGetSignedUrl,
}));
const mockBucket = vi.fn(() => ({
    file: mockStorageFile,
    upload: mockUpload,
}));

vi.mock('firebase-admin/storage', () => ({
    getStorage: vi.fn(() => ({ bucket: mockBucket })),
}));

// --- Firestore mock ---
const mockLogUpdate = vi.fn();
const mockLogsGet = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => ({
        collection: vi.fn(() => {
            const q = {
                where: vi.fn(() => q),
                limit: vi.fn(() => ({ get: mockLogsGet })),
            };
            return q;
        }),
    })),
}));

// --- sharp mock ---
const mockToFile = vi.fn();
vi.mock('sharp', () => ({
    default: vi.fn(() => {
        const s = { resize: vi.fn(() => s), toFile: mockToFile };
        return s;
    }),
}));

// --- fs mock ---
vi.mock('fs', () => ({
    existsSync: vi.fn(() => true),
    unlinkSync: vi.fn(),
}));

// --- os mock ---
vi.mock('os', () => ({
    tmpdir: vi.fn(() => '/tmp'),
}));

import { processReceipt } from '../receiptProcessing';

type Handler = (event: { data: Record<string, unknown> }) => Promise<void>;
const handler = processReceipt as unknown as Handler;

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        data: {
            name: 'receipts/user123/photo.jpg',
            contentType: 'image/jpeg',
            bucket: 'my-bucket',
            ...overrides,
        },
    };
}

describe('processReceipt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDownload.mockResolvedValue(undefined);
        mockUpload.mockResolvedValue(undefined);
        mockToFile.mockResolvedValue(undefined);
        mockGetSignedUrl.mockResolvedValue(['https://storage.example.com/signed-url']);
        mockLogsGet.mockResolvedValue({
            empty: true,
            docs: [],
        });
    });

    it('skips files outside the receipts/ prefix', async () => {
        await handler(makeEvent({ name: 'avatars/user123/pic.jpg' }));
        expect(mockDownload).not.toHaveBeenCalled();
    });

    it('skips non-image content types', async () => {
        await handler(makeEvent({ contentType: 'application/pdf' }));
        expect(mockDownload).not.toHaveBeenCalled();
    });

    it('skips files that are already thumbnails (thumb_ prefix)', async () => {
        await handler(makeEvent({ name: 'receipts/user123/thumb_photo.jpg' }));
        expect(mockDownload).not.toHaveBeenCalled();
    });

    it('downloads the original, resizes with sharp, and uploads the thumbnail', async () => {
        await handler(makeEvent());

        expect(mockDownload).toHaveBeenCalledWith({ destination: '/tmp/photo.jpg' });
        expect(mockToFile).toHaveBeenCalledWith('/tmp/thumb_photo.jpg');
        expect(mockUpload).toHaveBeenCalledWith(
            '/tmp/thumb_photo.jpg',
            expect.objectContaining({
                destination: 'receipts/user123/thumb_photo.jpg',
                metadata: { contentType: 'image/jpeg' },
            }),
        );
    });

    it('updates the matching fuelLog with receiptThumbUrl when found', async () => {
        const fakeDocRef = { update: mockLogUpdate };
        mockLogsGet.mockResolvedValue({
            empty: false,
            docs: [{ ref: fakeDocRef }],
        });

        await handler(makeEvent());

        expect(mockLogUpdate).toHaveBeenCalledWith({
            receiptThumbUrl: 'https://storage.example.com/signed-url',
        });
    });

    it('does not throw when no matching fuelLog is found', async () => {
        mockLogsGet.mockResolvedValue({ empty: true, docs: [] });

        await expect(handler(makeEvent())).resolves.not.toThrow();
        expect(mockLogUpdate).not.toHaveBeenCalled();
    });

    it('cleans up temp files even if an error occurs during resize', async () => {
        const { unlinkSync } = await import('fs');
        mockToFile.mockRejectedValue(new Error('sharp failed'));

        await expect(handler(makeEvent())).rejects.toThrow('sharp failed');
        expect(unlinkSync).toHaveBeenCalled();
    });
});
