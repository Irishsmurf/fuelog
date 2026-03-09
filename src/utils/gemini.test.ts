import { vi, describe, it, expect, beforeEach } from 'vitest';

process.env.VITE_GEMINI_API_KEY = 'test-api-key';

// Initialize mocks outside the factory for direct access
const mockGenerateContent = vi.fn().mockResolvedValue({
  response: {
    text: () => JSON.stringify({ cost: 45.67, fuelAmountLiters: 30.5, brand: 'Test Brand' }),
  },
});

// Mock the module with controlled behavior
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent,
        };
      }
    },
  };
});

describe('gemini utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Polyfill FileReader for Node.js environment
    class MockFileReader {
      onload: () => void = () => {};
      onerror: (err: any) => void = () => {};
      result: string = 'data:image/png;base64,mockbase64data';
      readAsDataURL() {
        setTimeout(() => {
          this.onload();
        }, 0);
      }
    }

    // @ts-ignore
    global.FileReader = MockFileReader;
  });

  it('extracts data from a receipt image successfully', async () => {
    // Re-import after mocking
    const gemini = await import('./gemini');

    const mockFile = new File(['mock content'], 'test.png', { type: 'image/png' });

    const result = await gemini.extractDataFromReceipt(mockFile);

    expect(result).toEqual({
      cost: 45.67,
      fuelAmountLiters: 30.5,
      brand: 'Test Brand',
    });
  });

  it('handles JSON parse error gracefully', async () => {
    // Change mock behavior for this test
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => 'Invalid JSON string',
      },
    });

    const gemini = await import('./gemini');
    const mockFile = new File(['mock content'], 'test.png', { type: 'image/png' });

    await expect(gemini.extractDataFromReceipt(mockFile)).rejects.toThrow('Failed to parse receipt data.');
  });
});
