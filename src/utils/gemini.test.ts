import { vi, describe, it, expect, beforeEach } from 'vitest';

process.env.VITE_GEMINI_API_KEY = 'test-api-key';

// We need to mock the @google/generative-ai module
vi.mock('@google/generative-ai', () => {
  const MockGenerativeModel = class {
    generateContent = vi.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify({ cost: 45.67, fuelAmountLiters: 30.5, brand: 'Test Brand' }),
      },
    });
  };

  const MockGoogleGenerativeAI = class {
    getGenerativeModel() {
      return new MockGenerativeModel();
    }
  };

  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
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
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    // Override the prototype method for this test specifically since we used a class
    // @ts-ignore
    const originalGetModel = GoogleGenerativeAI.prototype.getGenerativeModel;
    // @ts-ignore
    GoogleGenerativeAI.prototype.getGenerativeModel = function() {
      return {
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => 'Invalid JSON string',
          },
        }),
      };
    };

    const gemini = await import('./gemini');
    gemini.__resetGenAIForTest(); // Ensure we use the new prototype
    const mockFile = new File(['mock content'], 'test.png', { type: 'image/png' });

    await expect(gemini.extractDataFromReceipt(mockFile)).rejects.toThrow('Failed to parse receipt data.');

    // Restore
    // @ts-ignore
    GoogleGenerativeAI.prototype.getGenerativeModel = originalGetModel;
  });
});
