import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
}));
vi.mock('../firebase/config', () => ({ app: {} }));

const mockGetIdToken = vi.fn().mockResolvedValue('mock-id-token');

import { getAuth } from 'firebase/auth';

describe('gemini utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      currentUser: { getIdToken: mockGetIdToken },
    });

    // Polyfill FileReader for Node.js environment
    class MockFileReader {
      onload: () => void = () => {};
      onerror: (err: any) => void = () => {};
      result: string = 'data:image/png;base64,mockbase64data';
      readAsDataURL() {
        setTimeout(() => { this.onload(); }, 0);
      }
    }
    // @ts-ignore
    global.FileReader = MockFileReader;
  });

  it('extracts data from a receipt image successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cost: 45.67, fuelAmountLiters: 30.5, brand: 'Test Brand' }),
    });

    const { extractDataFromReceipt } = await import('./gemini');
    const mockFile = new File(['mock content'], 'test.png', { type: 'image/png' });

    const result = await extractDataFromReceipt(mockFile);

    expect(result).toEqual({ cost: 45.67, fuelAmountLiters: 30.5, brand: 'Test Brand' });
    expect(global.fetch).toHaveBeenCalledWith('/api/gemini', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Authorization': 'Bearer mock-id-token' }),
    }));
  });

  it('throws when the API returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to extract receipt data' }),
    });

    const { extractDataFromReceipt } = await import('./gemini');
    const mockFile = new File(['mock content'], 'test.png', { type: 'image/png' });

    await expect(extractDataFromReceipt(mockFile)).rejects.toThrow('Failed to extract receipt data');
  });

  it('throws when user is not authenticated', async () => {
    (getAuth as ReturnType<typeof vi.fn>).mockReturnValue({ currentUser: null });

    const { extractDataFromReceipt } = await import('./gemini');
    const mockFile = new File(['mock content'], 'test.png', { type: 'image/png' });

    await expect(extractDataFromReceipt(mockFile)).rejects.toThrow('User is not authenticated.');
  });
});
