// functions/src/receiptProcessing.ts
//
// Cloud Storage trigger: fires when a receipt image is uploaded.
// Resizes the image to a max width of 1200px and saves a thumbnail alongside
// the original at `receipts/{userId}/thumb_{filename}`.
// Also updates the matching fuelLog document with `receiptThumbUrl`.

import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import sharp from 'sharp';

const THUMB_MAX_WIDTH = 1200;
const RECEIPTS_PREFIX = 'receipts/';
const THUMB_PREFIX = 'thumb_';

export const processReceipt = onObjectFinalized({ bucket: 'fuelog-paddez.firebasestorage.app', region: 'us-central1' }, async (event) => {
    const object = event.data;
    const filePath = object.name ?? '';
    const contentType = object.contentType ?? '';

    // Only process files under receipts/ that are images
    if (!filePath.startsWith(RECEIPTS_PREFIX)) return;
    if (!contentType.startsWith('image/')) return;

    const fileName = path.basename(filePath);

    // Skip if this is already a thumbnail
    if (fileName.startsWith(THUMB_PREFIX)) return;

    const bucket = getStorage().bucket(object.bucket);
    const tempInputPath = path.join(os.tmpdir(), fileName);
    const thumbFileName = `${THUMB_PREFIX}${fileName}`;
    const tempThumbPath = path.join(os.tmpdir(), thumbFileName);
    const thumbStoragePath = path.join(path.dirname(filePath), thumbFileName);

    try {
        // Download original to temp dir
        await bucket.file(filePath).download({ destination: tempInputPath });

        // Resize with sharp
        await sharp(tempInputPath)
            .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
            .toFile(tempThumbPath);

        // Upload thumbnail back to Storage
        await bucket.upload(tempThumbPath, {
            destination: thumbStoragePath,
            metadata: { contentType },
        });

        // Build Firebase Storage download URL for the thumbnail.
        // Using getMetadata + token avoids the iam.serviceAccounts.signBlob permission
        // required by getSignedUrl, and produces the same URL format the client SDK uses.
        const thumbFile = bucket.file(thumbStoragePath);
        const [thumbMeta] = await thumbFile.getMetadata();
        const thumbToken = thumbMeta.metadata?.firebaseStorageDownloadTokens as string;
        const thumbUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(thumbStoragePath)}?alt=media&token=${thumbToken}`;

        // Build the Firebase download URL for the original file using the same method so
        // the URL matches what the client stored in fuelLogs.receiptUrl.
        const db = getFirestore();
        const [originalMeta] = await bucket.file(filePath).getMetadata();
        const originalToken = originalMeta.metadata?.firebaseStorageDownloadTokens as string;
        const originalFile = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${originalToken}`;

        // Extract userId from path: receipts/{userId}/filename
        const pathParts = filePath.split('/');
        if (pathParts.length >= 2) {
            const userId = pathParts[1];
            const logsSnap = await db
                .collection('fuelLogs')
                .where('userId', '==', userId)
                .where('receiptUrl', '==', originalFile)
                .limit(1)
                .get();

            if (!logsSnap.empty) {
                await logsSnap.docs[0].ref.update({ receiptThumbUrl: thumbUrl });
                console.log(`Updated fuelLog ${logsSnap.docs[0].id} with receiptThumbUrl.`);
            }
        }

        console.log(`Thumbnail created at ${thumbStoragePath}`);
    } finally {
        // Clean up temp files
        for (const f of [tempInputPath, tempThumbPath]) {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        }
    }
});
