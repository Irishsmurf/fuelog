import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findNearestStation } from './locationService';

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

    it('returns null on API error', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: false,
            status: 500
        } as Response);

        const result = await findNearestStation(53.3, -6.2);
        expect(result).toBeNull();
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
