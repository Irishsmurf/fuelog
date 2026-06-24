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

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to get 2D canvas context');
  }
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
  const isImage = file.type.startsWith('image/');
  let uploadData: Blob | File = file;
  let contentType = file.type;
  let fileName = `${Date.now()}_${file.name}`;

  if (isImage) {
    try {
      uploadData = await compressImage(file);
      contentType = 'image/jpeg';
      const baseName = file.name.replace(/\.[^.]+$/, '');
      fileName = `${Date.now()}_${baseName}.jpg`;
    } catch (error) {
      console.warn('Image compression failed, falling back to original file:', error);
    }
  }

  const storageRef = ref(storage, `receipts/${userId}/${fileName}`);

  try {
    const snapshot = await uploadBytes(storageRef, uploadData, { contentType });
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
