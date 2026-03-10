import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { ToyotaClient } from "./toyota-api/client";

const db = getFirestore();

// Helper to encrypt/decrypt strings (KMS or simpler AES if KMS not available)
// In a real production app, use Google Cloud KMS.
// For this MVP, we use a simple AES cipher driven by an environment variable.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const IV_LENGTH = 16;

function getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 32) {
        throw new Error("ENCRYPTION_KEY environment variable is missing or invalid. Must be exactly 32 characters.");
    }
    return key;
}

function encrypt(text: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-cbc", Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
    const key = getEncryptionKey();
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = createDecipheriv("aes-256-cbc", Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

/**
 * Callable function to link a Toyota account to a Fuelog vehicle.
 */
export const connectToyotaAccount = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    const { username, password, vehicleId } = request.data;
    if (!username || !password || !vehicleId) {
        throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    try {
        const client = new ToyotaClient();
        client.setCredentials(username, password);

        // 1. Login to get tokens
        const tokenInfo = await client.login();

        // 2. Fetch vehicles to ensure connection works and get VIN
        const vehiclesData = await client.getVehicles();
        if (!vehiclesData || !vehiclesData.payload || vehiclesData.payload.length === 0) {
             throw new HttpsError("not-found", "No vehicles found in Toyota account.");
        }

        // Just take the first vehicle for MVP.
        // In a real app, you'd let the user pick which VIN to link if multiple exist.
        const vin = vehiclesData.payload[0].vin;

        // 3. Encrypt the refresh token
        const encryptedToken = encrypt(tokenInfo.refresh_token);

        // 4. Update the vehicle in Firestore
        const vehicleRef = db.collection("vehicles").doc(vehicleId);
        const vehicleSnap = await vehicleRef.get();

        if (!vehicleSnap.exists || vehicleSnap.data()?.userId !== request.auth.uid) {
            throw new HttpsError("permission-denied", "Vehicle not found or not owned by user.");
        }

        await vehicleRef.update({
            toyotaRefreshToken: encryptedToken,
            toyotaUuid: tokenInfo.uuid,
            toyotaVin: vin,
            toyotaLastSync: null,
            toyotaLastFuelLevel: null,
            toyotaLastMileage: null
        });

        return { success: true, vin };

    } catch (error: any) {
        console.error("Toyota API Error:", error);
        throw new HttpsError("internal", "Failed to connect to Toyota Connected Services: " + error.message);
    }
});

/**
 * Scheduled function to sync data for all linked vehicles.
 * Runs every day at 3 AM.
 */
export const syncToyotaData = onSchedule("0 3 * * *", async (event) => {
    const vehiclesSnapshot = await db.collection("vehicles")
        .where("toyotaRefreshToken", "!=", null)
        .where("isArchived", "==", false)
        .get();

    for (const doc of vehiclesSnapshot.docs) {
        const data = doc.data();
        const vin = data.toyotaVin;
        const encryptedToken = data.toyotaRefreshToken;

        if (!vin || !encryptedToken) continue;

        try {
            const refreshToken = decrypt(encryptedToken);
            const client = new ToyotaClient("T", refreshToken, data.toyotaUuid);

            // Re-authenticate using the refresh token
            const tokenInfo = await client.login();

            // Fetch telemetry data
            const telemetry = await client.getTelemetry(vin);
            if (!telemetry || !telemetry.payload) continue;

            const currentMileage = telemetry.payload.odometer?.value;
            const currentFuelLevel = telemetry.payload.fuelLevel?.value; // Typically in %

            if (currentMileage == null || currentFuelLevel == null) continue;

            const previousFuelLevel = data.toyotaLastFuelLevel;
            const previousMileage = data.toyotaLastMileage;

            // Detect refueling event:
            // If the current fuel level is significantly higher than the previous recorded fuel level (e.g. > 10% jump)
            if (previousFuelLevel != null && (currentFuelLevel - previousFuelLevel) > 10) {
                // Approximate fuel added based on tank capacity or just log it for manual correction
                // This is a simplified logic. In real world, we need to know the tank size.
                // Assuming standard 45L tank for this MVP to calculate added liters:
                const assumedTankCapacityLiters = 45;
                const percentageAdded = currentFuelLevel - previousFuelLevel;
                const addedLiters = (percentageAdded / 100) * assumedTankCapacityLiters;

                const distanceCovered = previousMileage != null ? (currentMileage - previousMileage) : 0;

                await db.collection("fuelLogs").add({
                    userId: data.userId,
                    vehicleId: doc.id,
                    timestamp: Timestamp.now(),
                    brand: "Toyota Connected",
                    cost: 0, // Cannot determine cost from telemetry
                    distanceKm: distanceCovered,
                    fuelAmountLiters: Math.round(addedLiters * 100) / 100,
                    isToyotaSynced: true,
                });
            }

            // Update the vehicle document with the latest telemetry and potentially rotated refresh token
            await doc.ref.update({
                toyotaRefreshToken: encrypt(tokenInfo.refresh_token),
                toyotaLastSync: Timestamp.now(),
                toyotaLastFuelLevel: currentFuelLevel,
                toyotaLastMileage: currentMileage
            });

        } catch (err) {
            console.error(`Error syncing vehicle ${doc.id}:`, err);
        }
    }
});
