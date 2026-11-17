// functions/src/lookups.ts
//
// Server-side network lookups used to derive log fields: the nearest petrol
// station (OpenStreetMap Overpass) and a historical exchange rate
// (Frankfurter, the same source the web app uses). Query building and result
// selection live in @fuelog/core so client and server agree on the station.

import {
    overpassFuelQuery, pickNearestStation, STATION_SEARCH_RADIUS_METERS,
    type OSMStation, type OverpassElement,
} from '../../packages/core/src/overpass';

const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const FRANKFURTER_URL = 'https://api.frankfurter.app';

// Overpass rejects requests without an identifying User-Agent (HTTP 406).
const OVERPASS_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    'Accept-Language': 'en',
    'User-Agent': 'fuelog-functions/1.0 (+https://fuelog.paddez.com)',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface StationLookupOptions {
    radiusMeters?: number;
    /** Attempts in total, retrying HTTP 429/5xx and network errors. */
    attempts?: number;
    timeoutMs?: number;
    url?: string;
}

/**
 * Nearest fuel station within the radius, or null when there is none.
 * Throws when the lookup itself fails, so callers can tell "nothing nearby"
 * from "could not ask"; the trigger and migration both catch and move on.
 */
export async function findNearestStation(lat: number, lon: number, opts: StationLookupOptions = {}): Promise<OSMStation | null> {
    const { radiusMeters = STATION_SEARCH_RADIUS_METERS, attempts = 2, timeoutMs = 15000 } = opts;
    const url = opts.url ?? process.env.OVERPASS_URL ?? DEFAULT_OVERPASS_URL;
    const body = `data=${encodeURIComponent(overpassFuelQuery(lat, lon, radiusMeters))}`;
    let delay = 2000;
    for (let attempt = 1; ; attempt++) {
        let retryable = true;
        try {
            const res = await fetch(url, { method: 'POST', body, headers: OVERPASS_HEADERS, signal: AbortSignal.timeout(timeoutMs) });
            if (res.ok) {
                const data = (await res.json()) as { elements?: OverpassElement[] };
                return pickNearestStation(data.elements ?? [], lat, lon);
            }
            retryable = res.status === 429 || res.status >= 500;
            throw new Error(`Overpass responded with status ${res.status}`);
        } catch (err) {
            if (!retryable || attempt >= attempts) throw err;
            await sleep(delay);
            delay *= 2;
        }
    }
}

/**
 * How many units of `to` one unit of `from` was worth on `ymd` (YYYY-MM-DD),
 * or null when the rate can't be fetched. Never throws.
 */
export async function fetchExchangeRate(ymd: string, from: string, to: string, timeoutMs = 10000): Promise<number | null> {
    if (from === to) return 1;
    try {
        const res = await fetch(
            `${FRANKFURTER_URL}/${ymd}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
            { signal: AbortSignal.timeout(timeoutMs) },
        );
        if (!res.ok) return null;
        const data = (await res.json()) as { rates?: Record<string, number> };
        const rate = data.rates?.[to];
        return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null;
    } catch {
        return null;
    }
}
