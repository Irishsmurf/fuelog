import { createHmac } from "crypto";

export function generateHmacSha256(data: string, key: string): string {
    return createHmac("sha256", key).update(data).digest("hex");
}
