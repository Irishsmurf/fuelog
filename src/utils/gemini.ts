import { getAuth } from 'firebase/auth';
import { z } from "zod";
import { app } from '../firebase/config';

const ReceiptDataSchema = z.object({
  cost: z.number().nullable().optional().transform(v => typeof v === 'number' ? v : null),
  fuelAmountLiters: z.number().nullable().optional().transform(v => typeof v === 'number' ? v : null),
  brand: z.string().nullable().optional().transform(v => typeof v === 'string' ? v : null),
});

export type ReceiptData = z.infer<typeof ReceiptDataSchema>;

async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function extractDataFromReceipt(file: File): Promise<ReceiptData> {
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user) throw new Error('User is not authenticated.');

  const idToken = await user.getIdToken();
  const mimeType = file.type;
  const base64Data = await fileToBase64(file);

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ mimeType, base64Data }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to extract receipt data.');
  }

  const data = await response.json();
  return ReceiptDataSchema.parse(data);
}
