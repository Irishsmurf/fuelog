import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findNearestStation, geocodeAddress, isAccurateEnoughForStationMatch, GPS_ACCURACY_THRESHOLD_METERS } from './locationService';

describe('isAccurateEnoughForStationMatch', () => {
    it('returns true when accuracy is within the threshold', () => {
        expect(isAccurateEnoughForStationMatch(50)).toBe(true);
        expect(isAccurateEnoughForStationMatch(GPS_ACCURACY_THRESHOLD_METERS)).toBe(true);
    });

    it('returns false when accuracy exceeds the threshold', () => {
        expect(isAccurateEnoughForStationMatch(GPS_ACCURACY_THRESHOLD_METERS + 1)).toBe(false);
        expect(isAccurateEnoughForStationMatch(500)).toBe(false);
    });
});

describe('locationService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Mock global fetch
        global.fetch = vi.fn();
    });

    it('returns null when Overpass API returns no elements', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ elements: [] })
        } as Response);

        const result = await findNearestStation(53.3, -6.2);
        expect(result).toBeNull();
    });

    it('identifies and formats a petrol station correctly', async () => {
        const mockOsmData = {
            elements: [
                {
                    type: 'node',
                    id: 12345,
                    lat: 53.3498,
                    lon: -6.2603,
                    tags: {
                        amenity: 'fuel',
                        name: 'Shell Dublin',
                        brand: 'Shell',
                        'addr:street': 'O Connell Street'
                    }
                }
            ]
        };

        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => mockOsmData
        } as Response);

        const result = await findNearestStation(53.3498, -6.2603);
        
        expect(result).not.toBeNull();
        expect(result?.name).toBe('Shell Dublin');
        expect(result?.brand).toBe('Shell');
        expect(result?.osmId).toBe('node/12345');
        expect(result?.address).toBe('O Connell Street');
    });

    it('falls back to brand or operator if name is missing', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({
                elements: [
                    {
                        type: 'node',
                        id: 6789,
                        lat: 53.3,
                        lon: -6.2,
                        tags: {
                            amenity: 'fuel',
                            brand: 'Circle K'
                        }
                    }
                ]
            })
        } as Response);

        const result = await findNearestStation(53.3, -6.2);
        expect(result?.name).toBe('Circle K');
    });

    it('handles way-type stations with centers', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({
                elements: [
                    {
                        type: 'way',
                        id: 999,
                        tags: { amenity: 'fuel', name: 'Big Station' },
                        center: { lat: 53.4, lon: -6.3 }
                    }
                ]
            })
        } as Response);

        const result = await findNearestStation(53.4, -6.3);
        expect(result?.latitude).toBe(53.4);
        expect(result?.osmId).toBe('way/999');
    });

    it('throws on API error so callers can surface a warning', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: false,
            status: 500
        } as Response);

        await expect(findNearestStation(53.3, -6.2)).rejects.toThrow(
            'Overpass API responded with status 500'
        );
    });

    it('retries on 429 error and eventually succeeds', async () => {
        const mockFetch = vi.fn()
            .mockResolvedValueOnce({ status: 429, ok: false } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    elements: [{
                        type: 'node', id: 1, lat: 53.3, lon: -6.2,
                        tags: { amenity: 'fuel', name: 'Retry Station' }
                    }]
                })
            } as Response);

        global.fetch = mockFetch;

        const result = await findNearestStation(53.3, -6.2);
        
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result?.name).toBe('Retry Station');
    });
});

describe('geocodeAddress', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        global.fetch = vi.fn();
    });

    it('returns coordinates for the first Nominatim match', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ([{ lat: '53.3498', lon: '-6.2603' }]),
        } as Response);

        const result = await geocodeAddress('Shell, O Connell Street, Dublin');
        expect(result).toEqual({ latitude: 53.3498, longitude: -6.2603 });
    });

    it('returns null for an empty query without calling the API', async () => {
        const result = await geocodeAddress('   ');
        expect(result).toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null when no results are found', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ([]),
        } as Response);

        expect(await geocodeAddress('nowhere at all')).toBeNull();
    });

    it('returns null on a network/API error', async () => {
        vi.mocked(global.fetch).mockRejectedValue(new Error('network down'));
        expect(await geocodeAddress('anywhere')).toBeNull();
    });
});
