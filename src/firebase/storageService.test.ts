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

      (storage.ref as any).mockReturnValue({ path: 'test-ref' });
      (storage.uploadBytes as any).mockResolvedValue({ ref: 'snapshot-ref' });
      (storage.getDownloadURL as any).mockResolvedValue(mockDownloadUrl);

      const url = await uploadReceipt(mockFile, mockUserId);

      expect(url).toBe(mockDownloadUrl);
      expect(storage.ref).toHaveBeenCalled();
      expect(storage.uploadBytes).toHaveBeenCalled();
      expect(storage.getDownloadURL).toHaveBeenCalled();
    });

    it('throws an error if upload fails', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      (storage.uploadBytes as any).mockRejectedValue(new Error('Upload failed'));

      await expect(uploadReceipt(mockFile, 'user123')).rejects.toThrow('Upload failed');
    });
  });
});
