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

describe('storageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadReceipt', () => {
    it('successfully uploads a file and returns the download URL', async () => {
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
      expect(storage.uploadBytes).toHaveBeenCalled();
      expect(storage.getDownloadURL).toHaveBeenCalled();
    });

    it('throws an error if upload fails', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      vi.mocked(storage.uploadBytes).mockRejectedValue(new Error('Upload failed'));

      await expect(uploadReceipt(mockFile, 'user123')).rejects.toThrow('Upload failed');
    });
  });
});
