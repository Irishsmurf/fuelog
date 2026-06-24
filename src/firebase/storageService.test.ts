import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadReceipt } from './storageService';
import * as storage from 'firebase/storage';

// Mock config to avoid API key errors
vi.mock('./config', () => ({
  storage: {}
}));

// Mock the Firebase Storage module
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));

const mockBlob = new Blob(['compressed'], { type: 'image/jpeg' });

const mockCtx = {
  drawImage: vi.fn(),
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => mockCtx),
  toBlob: vi.fn((cb: BlobCallback) => cb(mockBlob)),
};

vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({
  width: 4000,
  height: 3000,
  close: vi.fn(),
}));

const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
  return originalCreateElement(tag);
});

describe('storageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadReceipt', () => {
    it('successfully uploads a compressed file and returns the download URL', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const mockUserId = 'user123';
      const mockDownloadUrl = 'https://firebase-storage.com/receipt.jpg';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(storage.ref).mockReturnValue({ path: 'test-ref' } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(storage.uploadBytes).mockResolvedValue({ ref: 'snapshot-ref' } as any);
      vi.mocked(storage.getDownloadURL).mockResolvedValue(mockDownloadUrl);

      const url = await uploadReceipt(mockFile, mockUserId);

      expect(url).toBe(mockDownloadUrl);
      expect(storage.ref).toHaveBeenCalled();
      expect(storage.uploadBytes).toHaveBeenCalledWith(
        expect.anything(),
        mockBlob,
        { contentType: 'image/jpeg' },
      );
      expect(storage.getDownloadURL).toHaveBeenCalled();
    });

    it('throws an error if upload fails', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      vi.mocked(storage.uploadBytes).mockRejectedValue(new Error('Upload failed'));

      await expect(uploadReceipt(mockFile, 'user123')).rejects.toThrow('Upload failed');
    });
  });
});
