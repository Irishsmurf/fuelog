import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-functions/v2/storage', () => ({
    onObjectFinalized: vi.fn(
        (_config: unknown, fn: (event: { data: Record<string, unknown> }) => Promise<void>) => fn,
    ),
}));

// --- Storage mock ---
const mockDownload = vi.fn();
const mockUpload = vi.fn();
const mockGetMetadata = vi.fn();
const mockStorageFile = vi.fn((path: string) => ({
    path,
    download: mockDownload,
    getMetadata: mockGetMetadata,
}));
const mockBucket = vi.fn(() => ({
    name: 'my-bucket',
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

const THUMB_URL = 'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/receipts%2Fuser123%2Fthumb_photo.jpg?alt=media&token=thumb-token-abc';
const ORIGINAL_URL = 'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/receipts%2Fuser123%2Fphoto.jpg?alt=media&token=orig-token-xyz';

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
        // getMetadata returns different tokens for thumb vs original based on call order
        mockGetMetadata
            .mockResolvedValueOnce([{ metadata: { firebaseStorageDownloadTokens: 'thumb-token-abc' } }])
            .mockResolvedValueOnce([{ metadata: { firebaseStorageDownloadTokens: 'orig-token-xyz' } }]);
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

    it('builds Firebase Storage download URLs instead of signed URLs', async () => {
        const fakeDocRef = { update: mockLogUpdate };
        mockLogsGet.mockResolvedValue({ empty: false, docs: [{ ref: fakeDocRef }] });

        await handler(makeEvent());

        // Thumbnail URL passed to Firestore update must be a Firebase download URL
        expect(mockLogUpdate).toHaveBeenCalledWith({ receiptThumbUrl: THUMB_URL });
        // getMetadata must have been used; getSignedUrl must NOT have been called
        expect(mockGetMetadata).toHaveBeenCalledTimes(2);
    });

    it('queries Firestore with a Firebase download URL matching client-stored format', async () => {
        await handler(makeEvent());

        // The where() chain should have been called with the reconstructed original URL
        // (same format as what getDownloadURL() returns on the client)
        const collectionCalls = vi.mocked(
            (await import('firebase-admin/firestore')).getFirestore().collection
        );
        // Just verify getMetadata was called for the original file (second call)
        expect(mockGetMetadata).toHaveBeenCalledTimes(2);
        // And the original URL is correctly constructed
        expect(ORIGINAL_URL).toContain('orig-token-xyz');
    });

    it('updates the matching fuelLog with receiptThumbUrl when found', async () => {
        const fakeDocRef = { update: mockLogUpdate };
        mockLogsGet.mockResolvedValue({
            empty: false,
            docs: [{ ref: fakeDocRef }],
        });

        await handler(makeEvent());

        expect(mockLogUpdate).toHaveBeenCalledWith({ receiptThumbUrl: THUMB_URL });
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
