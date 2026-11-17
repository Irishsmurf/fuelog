import { describe, it, expect } from 'vitest';
import {
  haversineDistanceKm, newStationDoc, overpassFuelQuery, pickNearestStation, stationDocId, type OverpassElement,
} from '../index.js';

const node = (id: number, lat: number, lon: number, tags: OverpassElement['tags'] = {}): OverpassElement => ({
  type: 'node', id, lat, lon, tags: { amenity: 'fuel', ...tags },
});

describe('pickNearestStation', () => {
  it('returns null when no fuel elements are present', () => {
    expect(pickNearestStation([{ type: 'node', id: 1, lat: 53.34, lon: -6.26, tags: {} }], 53.34, -6.26)).toBeNull();
    expect(pickNearestStation([], 53.34, -6.26)).toBeNull();
  });

  it('chooses the closest station to the query point', () => {
    const result = pickNearestStation([node(1, 53.4, -6.3, { name: 'Far' }), node(2, 53.341, -6.261, { name: 'Near' })], 53.34, -6.26);
    expect(result?.name).toBe('Near');
    expect(result?.id).toBe('node/2');
  });

  it('builds name, brand and address from tags', () => {
    const result = pickNearestStation([node(7, 53.34, -6.26, {
      name: 'Circle K', brand: 'Circle K', 'addr:street': 'Main St', 'addr:housenumber': '12',
    })], 53.34, -6.26);
    expect(result).toMatchObject({ osmId: 'node/7', name: 'Circle K', brand: 'Circle K', address: 'Main St 12' });
  });

  it('falls back to brand then a placeholder name, and operator for brand', () => {
    expect(pickNearestStation([node(1, 53.34, -6.26, { brand: 'Shell' })], 53.34, -6.26)?.name).toBe('Shell');
    const operatorOnly = pickNearestStation([node(2, 53.34, -6.26, { operator: 'Maxol' })], 53.34, -6.26);
    expect(operatorOnly?.name).toBe('Unknown Station');
    expect(operatorOnly?.brand).toBe('Maxol');
  });

  it('uses the center of a way/relation, then the query point, for its coordinates', () => {
    const way: OverpassElement = { type: 'way', id: 99, lat: 0, lon: 0, center: { lat: 53.34, lon: -6.26 }, tags: { amenity: 'fuel' } };
    expect(pickNearestStation([way], 53.34, -6.26)).toMatchObject({ id: 'way/99', latitude: 53.34, longitude: -6.26 });
    const bare: OverpassElement = { type: 'relation', id: 5, tags: { amenity: 'fuel' } };
    expect(pickNearestStation([bare], 1, 2)).toMatchObject({ latitude: 1, longitude: 2 });
  });
});

describe('station helpers', () => {
  it('stationDocId replaces every slash', () => {
    expect(stationDocId('node/123')).toBe('node_123');
    expect(stationDocId('relation/1/2')).toBe('relation_1_2');
  });

  it('newStationDoc zeroes the legacy stats the rules require', () => {
    expect(newStationDoc({ id: 'node/1', osmId: 'node/1', name: 'S', latitude: 1, longitude: 2 })).toEqual({
      osmId: 'node/1', name: 'S', brand: '', latitude: 1, longitude: 2, address: '', logCount: 0, avgPrice: 0,
    });
  });

  it('overpassFuelQuery searches nodes, ways and relations within the radius', () => {
    const q = overpassFuelQuery(53.3, -6.2, 250);
    expect(q).toContain('node["amenity"="fuel"](around:250,53.3,-6.2)');
    expect(q).toContain('way["amenity"="fuel"](around:250,53.3,-6.2)');
    expect(q).toContain('relation["amenity"="fuel"](around:250,53.3,-6.2)');
  });

  it('haversineDistanceKm approximates a short distance', () => {
    expect(haversineDistanceKm(53.34, -6.26, 53.34, -6.26)).toBe(0);
    expect(haversineDistanceKm(53.34, -6.26, 53.341, -6.26)).toBeCloseTo(0.111, 2);
  });
});
