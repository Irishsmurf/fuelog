import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock firebase/config before importing gemini
vi.mock('../firebase/config', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    },
  },
  analytics: Promise.resolve(null),
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

  it('scales down images larger than MAX_DIMENSION', async () => {
    // Simulate a 2000x1500 image — should be scaled to 768x576 in dev
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 2000,
      height: 1500,
      close: vi.fn(),
    });
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
      toBlob: vi.fn((cb: BlobCallback) => {
        cb(new Blob(['mock'], { type: 'image/jpeg' }));
      }),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLCanvasElement);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cost: 10, fuelAmountLiters: 5, brand: 'Shell' }),
    }) as unknown as typeof fetch;

    const gemini = await import('./gemini');
    await gemini.extractDataFromReceipt(new File(['x'], 'big.jpg', { type: 'image/jpeg' }));

    // In dev: MAX_DIMENSION=768, scale = 768/2000 = 0.384 → 768x576
    expect(mockCanvas.width).toBe(768);
    expect(mockCanvas.height).toBe(576);
  });

  it('does not upscale images smaller than MAX_DIMENSION', async () => {
    // 400x300 image — should remain 400x300
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 400,
      height: 300,
      close: vi.fn(),
    });
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
      toBlob: vi.fn((cb: BlobCallback) => {
        cb(new Blob(['mock'], { type: 'image/jpeg' }));
      }),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLCanvasElement);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cost: 10, fuelAmountLiters: 5, brand: 'Shell' }),
    }) as unknown as typeof fetch;

    const gemini = await import('./gemini');
    await gemini.extractDataFromReceipt(new File(['x'], 'small.jpg', { type: 'image/jpeg' }));

    expect(mockCanvas.width).toBe(400);
    expect(mockCanvas.height).toBe(300);
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
