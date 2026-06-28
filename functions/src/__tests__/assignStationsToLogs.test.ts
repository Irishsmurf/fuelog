import { describe, it, expect } from 'vitest';
import {
  selectUnassignedLogs,
  pickNearestStation,
  stationDocId,
  pricePerLitre,
  haversineDistanceKm,
  AssignLog,
  OverpassElement,
} from '../scripts/assignStationsToLogs';

const log = (over: Partial<AssignLog> = {}): AssignLog => ({
  id: 'l1',
  userId: 'u1',
  latitude: 53.34,
  longitude: -6.26,
  ...over,
});

describe('selectUnassignedLogs', () => {
  it('keeps logs with coordinates and no station', () => {
    const result = selectUnassignedLogs([log({ id: 'keep' })]);
    expect(result.map((l) => l.id)).toEqual(['keep']);
  });

  it('drops logs that already have a station', () => {
    expect(selectUnassignedLogs([log({ stationId: 'node_1' })])).toHaveLength(0);
  });

  it('drops logs missing either coordinate', () => {
    expect(selectUnassignedLogs([log({ latitude: undefined })])).toHaveLength(0);
    expect(selectUnassignedLogs([log({ longitude: undefined })])).toHaveLength(0);
  });

  it('keeps logs sitting exactly on the equator/prime meridian (0 is valid)', () => {
    expect(selectUnassignedLogs([log({ latitude: 0, longitude: 0 })])).toHaveLength(1);
  });

  it('drops logs with non-finite coordinates', () => {
    expect(selectUnassignedLogs([log({ latitude: NaN })])).toHaveLength(0);
  });
});

describe('pickNearestStation', () => {
  const node = (
    id: number,
    lat: number,
    lon: number,
    tags: OverpassElement['tags'] = {},
  ): OverpassElement => ({
    type: 'node',
    id,
    lat,
    lon,
    tags: { amenity: 'fuel', ...tags },
  });

  it('returns null when no fuel elements are present', () => {
    const nonFuel: OverpassElement = { type: 'node', id: 1, lat: 53.34, lon: -6.26, tags: {} };
    expect(pickNearestStation([nonFuel], 53.34, -6.26)).toBeNull();
  });

  it('chooses the closest station to the query point', () => {
    const far = node(1, 53.4, -6.3, { name: 'Far' });
    const near = node(2, 53.341, -6.261, { name: 'Near' });
    const result = pickNearestStation([far, near], 53.34, -6.26);
    expect(result?.name).toBe('Near');
    expect(result?.id).toBe('node/2');
  });

  it('builds name, brand and address from tags', () => {
    const station = node(7, 53.34, -6.26, {
      name: 'Circle K',
      brand: 'Circle K',
      'addr:street': 'Main St',
      'addr:housenumber': '12',
    });
    const result = pickNearestStation([station], 53.34, -6.26);
    expect(result).toMatchObject({
      osmId: 'node/7',
      name: 'Circle K',
      brand: 'Circle K',
      address: 'Main St 12',
    });
  });

  it('falls back to brand then a placeholder name, and operator for brand', () => {
    const brandOnly = pickNearestStation([node(1, 53.34, -6.26, { brand: 'Shell' })], 53.34, -6.26);
    expect(brandOnly?.name).toBe('Shell');

    const operatorOnly = pickNearestStation(
      [node(2, 53.34, -6.26, { operator: 'Maxol' })],
      53.34,
      -6.26,
    );
    expect(operatorOnly?.name).toBe('Unknown Station');
    expect(operatorOnly?.brand).toBe('Maxol');
  });

  it('uses the center of a way/relation for its coordinates', () => {
    const way: OverpassElement = {
      type: 'way',
      id: 99,
      lat: 0,
      lon: 0,
      center: { lat: 53.34, lon: -6.26 },
      tags: { amenity: 'fuel', name: 'Big Forecourt' },
    };
    const result = pickNearestStation([way], 53.34, -6.26);
    expect(result?.id).toBe('way/99');
    expect(result?.latitude).toBeCloseTo(53.34);
    expect(result?.longitude).toBeCloseTo(-6.26);
  });
});

describe('stationDocId', () => {
  it('replaces every slash so the id is a valid Firestore doc id', () => {
    expect(stationDocId('node/123')).toBe('node_123');
    expect(stationDocId('relation/1/2')).toBe('relation_1_2');
  });
});

describe('pricePerLitre', () => {
  it('divides cost by litres', () => {
    expect(pricePerLitre(75, 50)).toBeCloseTo(1.5);
  });

  it('returns null for missing, non-finite, or non-positive litres', () => {
    expect(pricePerLitre(undefined, 50)).toBeNull();
    expect(pricePerLitre(75, undefined)).toBeNull();
    expect(pricePerLitre(75, 0)).toBeNull();
    expect(pricePerLitre(75, -10)).toBeNull();
    expect(pricePerLitre(NaN, 50)).toBeNull();
  });
});

describe('haversineDistanceKm', () => {
  it('is zero for identical points', () => {
    expect(haversineDistanceKm(53.34, -6.26, 53.34, -6.26)).toBe(0);
  });

  it('approximates a known short distance', () => {
    // ~111 m north (0.001 deg latitude).
    expect(haversineDistanceKm(53.34, -6.26, 53.341, -6.26)).toBeCloseTo(0.111, 2);
  });
});
