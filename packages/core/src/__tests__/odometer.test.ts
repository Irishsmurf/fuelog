import { describe, it, expect } from 'vitest';
import { deriveDistances, findOdometerViolations, previousReading, type OdometerEntry } from '../index.js';

/** Small deterministic PRNG so the property tests are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** A random but valid history: strictly increasing readings, shuffled. */
function randomHistory(seed: number, n: number): OdometerEntry[] {
  const r = rng(seed);
  let odo = Math.floor(r() * 100000);
  const entries: OdometerEntry[] = [];
  for (let i = 0; i < n; i++) {
    odo += 1 + Math.floor(r() * 900);
    entries.push({ id: `l${i}`, at: i * 86_400_000, odometerKm: r() < 0.2 ? undefined : odo });
  }
  return entries.sort(() => r() - 0.5);
}

describe('odometer rules (property tests)', () => {
  for (let seed = 1; seed <= 25; seed++) {
    it(`valid history #${seed} has no violations and positive derived distances`, () => {
      const h = randomHistory(seed, 40);
      expect(findOdometerViolations(h)).toEqual([]);
      const d = deriveDistances(h);
      for (const v of d.values()) expect(v).toBeGreaterThan(0);
      // Sum of derived distances = last reading - first reading.
      const readings = h.filter(e => e.odometerKm !== undefined).sort((a, b) => a.at - b.at);
      const span = readings[readings.length - 1].odometerKm! - readings[0].odometerKm!;
      expect([...d.values()].reduce((a, b) => a + b, 0)).toBe(span);
    });
  }

  it('flags a reading that goes backwards, regardless of input order', () => {
    const h: OdometerEntry[] = [
      { id: 'c', at: 3, odometerKm: 1200 },
      { id: 'a', at: 1, odometerKm: 1000 },
      { id: 'b', at: 2, odometerKm: 1300 },
    ];
    expect(findOdometerViolations(h)).toEqual([
      { id: 'c', previousId: 'b', odometerKm: 1200, previousOdometerKm: 1300 },
    ]);
  });
});

describe('previousReading', () => {
  const h: OdometerEntry[] = [
    { id: 'a', at: 100, odometerKm: 1000 },
    { id: 'b', at: 300, odometerKm: 1600 },
    { id: 'c', at: 200 }, // no reading
  ];

  it('uses the reading just before the fill-up time (back-dating safe)', () => {
    expect(previousReading(h, 250)).toBe(1000);
    expect(previousReading(h, 400)).toBe(1600);
  });

  it('returns null when nothing is earlier', () => {
    expect(previousReading(h, 50)).toBeNull();
  });
});

describe('deriveDistances after an edit/delete', () => {
  it('recomputes the following log when a middle log is removed', () => {
    const full: OdometerEntry[] = [
      { id: 'a', at: 1, odometerKm: 1000 },
      { id: 'b', at: 2, odometerKm: 1400 },
      { id: 'c', at: 3, odometerKm: 1900 },
    ];
    expect(deriveDistances(full).get('c')).toBe(500);
    expect(deriveDistances(full.filter(e => e.id !== 'b')).get('c')).toBe(900);
  });
});
