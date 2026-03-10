export const CLIENT_VERSION = "2.14.0";
export const API_BASE_URL = "https://ctpa-oneapi.tceu-ctp-prd.toyotaconnectedeurope.io";
export const ACCESS_TOKEN_URL = "https://b2c-login.toyota-europe.com/oauth2/realms/root/realms/tme/access_token";
export const AUTHENTICATE_URL = "https://b2c-login.toyota-europe.com/json/realms/root/realms/tme/authenticate?authIndexType=service&authIndexValue=oneapp";
export const AUTHORIZE_URL = "https://b2c-login.toyota-europe.com/oauth2/realms/root/realms/tme/authorize?client_id=oneapp&scope=openid+profile+write&response_type=code&redirect_uri=com.toyota.oneapp:/oauth2Callback&code_challenge=plain&code_challenge_method=plain";

export const VEHICLE_GUID_ENDPOINT = "/v2/vehicle/guid";
export const VEHICLE_GLOBAL_REMOTE_ELECTRIC_STATUS_ENDPOINT = "/v1/global/remote/electric/status";
export const VEHICLE_TELEMETRY_ENDPOINT = "/v3/telemetry";

// Reverse engineered from client app, best to inject via ENV
export const API_KEY = process.env.TOYOTA_API_KEY || "tTZipv6liF74PwMfk9Ed68AQ0bISswwf3iHQdqcF";
