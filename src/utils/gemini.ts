import { auth, analytics } from '../firebase/config';
import { logEvent } from 'firebase/analytics';

export interface ReceiptData {
  cost: number | null;
  fuelAmountLiters: number | null;
  brand: string | null;
}

// Local `vercel dev` uses Express with a ~100KB body limit.
// Production Vercel allows up to 4.5MB — use higher quality for better OCR accuracy.
const MAX_DIMENSION = import.meta.env.DEV ? 768 : 1600;
const JPEG_QUALITY = import.meta.env.DEV ? 0.7 : 0.9;

async function resizeAndEncode(file: File): Promise<{ base64Data: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) return reject(new Error('Failed to compress image'));
        const reader = new FileReader();
        reader.onload = () => resolve({
          base64Data: (reader.result as string).split(',')[1],
          mimeType: 'image/jpeg',
        });
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

export async function extractDataFromReceipt(file: File): Promise<ReceiptData> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User is not authenticated.');
  }
  const idToken = await user.getIdToken();

  analytics.then(a => { if (a) logEvent(a, 'receipt_scan_started'); });

  const { base64Data, mimeType } = await resizeAndEncode(file);

  const response = await fetch('/api/extract-receipt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ base64Data, mimeType }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    analytics.then(a => { if (a) logEvent(a, 'receipt_scan_failed', { status_code: response.status }); });
    throw new Error((err as { error?: string }).error || 'Failed to extract data from receipt.');
  }

  analytics.then(a => { if (a) logEvent(a, 'receipt_scan_success'); });
  return response.json() as Promise<ReceiptData>;
}
