import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock firebase/config before importing gemini
vi.mock('../firebase/config', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    },
  },
}));

describe('gemini utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock createImageBitmap (not available in jsdom)
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
      close: vi.fn(),
    });

    // Mock canvas + toBlob
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
      toBlob: vi.fn((cb: BlobCallback) => {
        cb(new Blob(['mock'], { type: 'image/jpeg' }));
      }),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLCanvasElement);

    class MockFileReader {
      onload: () => void = () => {};
      onerror: (err: unknown) => void = () => {};
      result: string = 'data:image/jpeg;base64,mockbase64data';
      readAsDataURL() {
        setTimeout(() => this.onload(), 0);
      }
    }
    // @ts-expect-error - Mocking global object for testing purposes
    global.FileReader = MockFileReader;
  });

  it('extracts data from a receipt image successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cost: 45.67, fuelAmountLiters: 30.5, brand: 'Test Brand' }),
    }) as unknown as typeof fetch;

    const gemini = await import('./gemini');
    const mockFile = new File(['mock content'], 'test.png', { type: 'image/png' });
    const result = await gemini.extractDataFromReceipt(mockFile);

    expect(result).toEqual({ cost: 45.67, fuelAmountLiters: 30.5, brand: 'Test Brand' });
    expect(fetch).toHaveBeenCalledWith('/api/extract-receipt', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer mock-id-token' }),
    }));
  });

  it('throws when the API returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed to extract data from receipt.' }),
    }) as unknown as typeof fetch;

    const gemini = await import('./gemini');
    const mockFile = new File(['mock content'], 'test.png', { type: 'image/png' });

    await expect(gemini.extractDataFromReceipt(mockFile)).rejects.toThrow('Failed to extract data from receipt.');
  });
});
