import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ReceiptData {
  cost: number | null;
  fuelAmountLiters: number | null;
  brand: string | null;
}

// We instantiate inside the function or lazily so tests can mock env vars easily
let genAIInstance: GoogleGenerativeAI | null = null;

export function __resetGenAIForTest() {
  genAIInstance = null;
}

function getGenAI(): GoogleGenerativeAI {
  if (genAIInstance) return genAIInstance;
  // Ensure we check process.env for Node.js test environment, fallback to import.meta.env
  const apiKey = typeof process !== 'undefined' && process.env ? process.env.VITE_GEMINI_API_KEY : import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }
  genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
}

export async function extractDataFromReceipt(file: File): Promise<ReceiptData> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const mimeType = file.type;

  // Read file as base64 string
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const result = reader.result as string;
        // The result is in format "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
        const base64 = result.split(',')[1];
        resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const prompt = `
    Analyze this receipt image and extract the following information for a fuel purchase:
    1. Total Cost (as a number)
    2. Fuel Amount in Liters (as a number)
    3. Filling Station Brand Name (as a string)

    Return ONLY a raw JSON object with exactly these keys: "cost", "fuelAmountLiters", "brand".
    If a value cannot be found, use null.
    Do not use markdown formatting like \`\`\`json.
  `;

  try {
    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: base64Data,
                mimeType
            }
        }
    ]);

    const text = result.response.text();
    // Parse the JSON string
    try {
        let jsonText = text.trim();
        // The model can sometimes wrap the JSON in markdown backticks.
        const jsonMatch = jsonText.match(/```(?:json)?\n([\s\S]*?)\n```/s);
        if (jsonMatch?.[1]) {
          jsonText = jsonMatch[1];
        }
        const data = JSON.parse(jsonText);
        return {
            cost: data.cost !== undefined ? data.cost : null,
            fuelAmountLiters: data.fuelAmountLiters !== undefined ? data.fuelAmountLiters : null,
            brand: data.brand !== undefined ? data.brand : null,
        };
    } catch (parseError) {
        console.error("Failed to parse Gemini response as JSON:", text);
        throw new Error("Failed to parse receipt data.");
    }

  } catch (error) {
      console.error("Error extracting data from receipt:", error);
      throw error;
  }
}
