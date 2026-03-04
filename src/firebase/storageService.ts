import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * @param file The file to upload.
 * @param userId The UID of the user.
 * @returns Promise resolving to the download URL string.
 */
export const uploadReceipt = async (file: File, userId: string): Promise<string> => {
  const fileName = `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `receipts/${userId}/${fileName}`);
  
  try {
    const snapshot = await uploadBytes(storageRef, file);
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
