import { auth } from '../firebase/config';

export interface ReceiptData {
  cost: number | null;
  fuelAmountLiters: number | null;
  brand: string | null;
}

export async function extractDataFromReceipt(file: File): Promise<ReceiptData> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User is not authenticated.');
  }
  const idToken = await user.getIdToken();

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await fetch('/api/extract-receipt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ base64Data, mimeType: file.type }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to extract data from receipt.');
  }

  return response.json() as Promise<ReceiptData>;
}
