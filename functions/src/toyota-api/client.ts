import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import {
    API_BASE_URL,
    ACCESS_TOKEN_URL,
    AUTHENTICATE_URL,
    AUTHORIZE_URL,
    CLIENT_VERSION,
    API_KEY,
    VEHICLE_GUID_ENDPOINT,
    VEHICLE_GLOBAL_REMOTE_ELECTRIC_STATUS_ENDPOINT,
    VEHICLE_TELEMETRY_ENDPOINT
} from "./const";
import { generateHmacSha256 } from "./utils";

export interface TokenInfo {
    access_token: string;
    refresh_token: string;
    uuid: string;
    expiration: Date;
}

export class ToyotaClient {
    private username?: string;
    private password?: string;
    private tokenInfo?: TokenInfo;

    // Only refresh token is strictly needed for sync operations
    constructor(private brand: string = "T", refreshToken?: string, uuid?: string) {
        if (refreshToken) {
            this.tokenInfo = {
                access_token: "",
                refresh_token: refreshToken,
                uuid: uuid || "",
                expiration: new Date(0)
            };
        }
    }

    setCredentials(username: string, password: string) {
        this.username = username;
        this.password = password;
    }

    private isTokenValid(): boolean {
        if (!this.tokenInfo || !this.tokenInfo.access_token) return false;
        return this.tokenInfo.expiration.getTime() > Date.now();
    }

    async login(): Promise<TokenInfo> {
        if (this.isTokenValid() && this.tokenInfo) {
            return this.tokenInfo;
        }

        if (this.tokenInfo?.refresh_token) {
            try {
                await this.refreshTokens();
                if (this.tokenInfo) return this.tokenInfo;
            } catch (error) {
                console.warn("Token refresh failed, will attempt full auth if credentials exist.", error);
            }
        }

        if (!this.username || !this.password) {
            throw new Error("No valid token and no credentials provided.");
        }

        await this.authenticate();
        if (!this.tokenInfo) throw new Error("Authentication failed to return tokens.");
        return this.tokenInfo;
    }

    private async authenticate(): Promise<void> {
        // 1. Authentication Flow
        let authData: any = {};
        let attempt = 0;

        while (attempt < 10) {
            if (authData.callbacks) {
                for (const cb of authData.callbacks) {
                    if (cb.type === "NameCallback" && cb.output[0].value === "User Name") {
                        cb.input[0].value = this.username;
                    } else if (cb.type === "PasswordCallback") {
                        cb.input[0].value = this.password;
                    } else if (cb.type === "TextOutputCallback" && cb.output[0].value === "User Not Found") {
                        throw new Error("Toyota Login Failed: User Not Found");
                    }
                }
            }

            const res = await fetch(AUTHENTICATE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(authData)
            });

            if (!res.ok) {
                throw new Error(`Authentication Failed. ${res.status} ${await res.text()}`);
            }

            authData = await res.json();
            if (authData.tokenId) {
                break;
            }
            attempt++;
        }

        if (!authData.tokenId) {
            throw new Error("Authentication Failed. Token ID not received.");
        }

        // 2. Authorization Flow
        const authRes = await fetch(AUTHORIZE_URL, {
            method: "GET",
            headers: { "cookie": `iPlanetDirectoryPro=${authData.tokenId}` },
            redirect: "manual"
        });

        if (authRes.status !== 302) {
            throw new Error(`Authorization failed. Status: ${authRes.status}`);
        }

        const location = authRes.headers.get("location");
        if (!location) throw new Error("Authorization failed. No redirect location.");

        const url = new URL(location);
        const authCode = url.searchParams.get("code");

        if (!authCode) throw new Error("Authorization failed. No code in redirect.");

        // 3. Token Retrieval
        const tokenRes = await fetch(ACCESS_TOKEN_URL, {
            method: "POST",
            headers: {
                "authorization": "basic b25lYXBwOm9uZWFwcA==",
                "content-type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                "client_id": "oneapp",
                "code": authCode,
                "redirect_uri": "com.toyota.oneapp:/oauth2Callback",
                "grant_type": "authorization_code",
                "code_verifier": "plain"
            }).toString()
        });

        if (!tokenRes.ok) {
            throw new Error(`Token retrieval failed. Status: ${tokenRes.status}`);
        }

        const tokenData = await tokenRes.json();
        this.updateTokens(tokenData);
    }

    private async refreshTokens(): Promise<void> {
        if (!this.tokenInfo?.refresh_token) throw new Error("No refresh token available");

        const res = await fetch(ACCESS_TOKEN_URL, {
            method: "POST",
            headers: {
                "authorization": "basic b25lYXBwOm9uZWFwcA==",
                "content-type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                "client_id": "oneapp",
                "redirect_uri": "com.toyota.oneapp:/oauth2Callback",
                "grant_type": "refresh_token",
                "code_verifier": "plain",
                "refresh_token": this.tokenInfo.refresh_token
            }).toString()
        });

        if (!res.ok) {
            throw new Error(`Token refresh failed. Status: ${res.status}`);
        }

        const data = await res.json();
        this.updateTokens(data);
    }

    private updateTokens(data: any) {
        if (!data.access_token || !data.id_token || !data.refresh_token || !data.expires_in) {
            throw new Error("Token retrieval failed. Missing fields.");
        }

        let uuid = this.tokenInfo?.uuid;

        // Try extracting UUID from id_token if present
        if (data.id_token) {
            const decoded = jwt.decode(data.id_token) as any;
            if (decoded?.uuid) {
                uuid = decoded.uuid;
            }
        }

        if (!uuid) {
            throw new Error("Invalid or missing ID token: cannot determine uuid.");
        }

        this.tokenInfo = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            uuid: uuid,
            expiration: new Date(Date.now() + data.expires_in * 1000)
        };
    }

    private async requestRaw(method: string, endpoint: string, vin?: string): Promise<any> {
        await this.login();

        if (!this.tokenInfo) throw new Error("Authentication failed");

        const headers: any = {
            "x-api-key": API_KEY,
            "API_KEY": API_KEY,
            "x-guid": this.tokenInfo.uuid,
            "guid": this.tokenInfo.uuid,
            "x-client-ref": generateHmacSha256(CLIENT_VERSION, this.tokenInfo.uuid),
            "x-correlationid": randomUUID(),
            "x-appversion": CLIENT_VERSION,
            "x-channel": "ONEAPP",
            "x-brand": this.brand,
            "x-region": "EU",
            "authorization": `Bearer ${this.tokenInfo.access_token}`,
            "user-agent": "okhttp/4.10.0"
        };

        if (this.brand === "L") {
            headers["x-appbrand"] = "L";
            headers["brand"] = "L";
        }

        if (vin) {
            headers["vin"] = vin;
        }

        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method,
            headers
        });

        if (res.status === 204) return null;

        if (!res.ok) {
            throw new Error(`Toyota API Request Failed. ${res.status} ${await res.text()}`);
        }

        return res.json();
    }

    async getVehicles() {
        return this.requestRaw("GET", VEHICLE_GUID_ENDPOINT);
    }

    async getElectricStatus(vin: string) {
        return this.requestRaw("GET", VEHICLE_GLOBAL_REMOTE_ELECTRIC_STATUS_ENDPOINT, vin);
    }

    async getTelemetry(vin: string) {
        return this.requestRaw("GET", VEHICLE_TELEMETRY_ENDPOINT, vin);
    }
}
