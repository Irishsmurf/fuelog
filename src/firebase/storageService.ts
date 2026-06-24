import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

const STORAGE_MAX_DIMENSION = 1600;
const STORAGE_JPEG_QUALITY = 0.8;

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const scale = Math.min(1, STORAGE_MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Failed to compress image')),
      'image/jpeg',
      STORAGE_JPEG_QUALITY,
    );
  });
}

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * @param file The file to upload.
 * @param userId The UID of the user.
 * @returns Promise resolving to the download URL string.
 */
export const uploadReceipt = async (file: File, userId: string): Promise<string> => {
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const fileName = `${Date.now()}_${baseName}.jpg`;
  const storageRef = ref(storage, `receipts/${userId}/${fileName}`);

  try {
    const compressed = await compressImage(file);
    const snapshot = await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading receipt:", error);
    throw error;
  }
};

/**
 * Deletes a file from Firebase Storage.
 * @param url The download URL of the file to delete.
 */
export const deleteReceipt = async (url: string): Promise<void> => {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (error) {
    console.error("Error deleting receipt:", error);
    // Non-critical: we don't throw to avoid blocking log deletion
  }
};
