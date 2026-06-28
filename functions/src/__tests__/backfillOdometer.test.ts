import { describe, it, expect } from 'vitest';
import { planOdometerBackfill, summarizeGroups, BackfillLog } from '../scripts/backfillOdometer';

// Build a log with a fake Timestamp ordered by `day`.
const makeLog = (
  id: string,
  day: number,
  distanceKm: number,
  odometerKm?: number,
  vehicleId = 'car1',
  userId = 'user1',
): BackfillLog => ({
  id,
  userId,
  vehicleId,
  timestamp: { toMillis: () => day },
  distanceKm,
  ...(odometerKm !== undefined ? { odometerKm } : {}),
});

const odoOf = (plan: ReturnType<typeof planOdometerBackfill>, id: string) =>
  plan.updates.find((u) => u.id === id)?.odometerKm;

describe('planOdometerBackfill', () => {
  it('reconstructs earlier readings by walking backwards from the latest known value', () => {
    const logs = [
      makeLog('a', 1, 100),
      makeLog('b', 2, 200),
      makeLog('c', 3, 300),
      makeLog('d', 4, 150, 1000), // anchor
    ];

    const plan = planOdometerBackfill(logs);

    // d = 1000 (known). c = 1000 - 150 = 850. b = 850 - 300 = 550. a = 550 - 200 = 350.
    expect(odoOf(plan, 'c')).toBe(850);
    expect(odoOf(plan, 'b')).toBe(550);
    expect(odoOf(plan, 'a')).toBe(350);
    expect(plan.updates).toHaveLength(3);
    expect(plan.alreadySet).toBe(1);
    expect(plan.skipped).toBe(0);
    expect(plan.vehiclesAnchored).toBe(1);
    expect(plan.vehiclesWithoutAnchor).toBe(0);
  });

  it('walks forwards to fill gaps after a known reading', () => {
    const logs = [
      makeLog('a', 1, 100, 500), // anchor
      makeLog('b', 2, 200),
      makeLog('c', 3, 300),
    ];

    const plan = planOdometerBackfill(logs);

    expect(odoOf(plan, 'b')).toBe(700); // 500 + 200
    expect(odoOf(plan, 'c')).toBe(1000); // 700 + 300
    expect(plan.skipped).toBe(0);
  });

  it('never overwrites existing readings and re-anchors on them', () => {
    const logs = [
      makeLog('a', 1, 100),
      makeLog('b', 2, 200, 600), // known anchor in the middle
      makeLog('c', 3, 300),
      makeLog('d', 4, 150, 999), // a second known reading
    ];

    const plan = planOdometerBackfill(logs);

    expect(odoOf(plan, 'b')).toBeUndefined();
    expect(odoOf(plan, 'd')).toBeUndefined();
    expect(odoOf(plan, 'a')).toBe(400); // 600 - 200, backwards from b
    // c sits between two anchors; the forward pass from the earliest anchor (b)
    // reaches it first: 600 + 300 = 900.
    expect(odoOf(plan, 'c')).toBe(900);
    expect(plan.alreadySet).toBe(2);
  });

  it('reconstructs each vehicle independently', () => {
    const logs = [
      makeLog('a1', 1, 50, undefined, 'car1'),
      makeLog('a2', 2, 50, 2000, 'car1'),
      makeLog('b1', 1, 80, undefined, 'car2'),
      makeLog('b2', 2, 80, 5000, 'car2'),
    ];

    const plan = planOdometerBackfill(logs);

    expect(odoOf(plan, 'a1')).toBe(1950); // 2000 - 50
    expect(odoOf(plan, 'b1')).toBe(4920); // 5000 - 80
    expect(plan.vehiclesAnchored).toBe(2);
  });

  it('keeps different users separate even on the same vehicle id', () => {
    const logs = [
      makeLog('u1', 2, 50, 2000, 'shared', 'userA'),
      makeLog('u1prev', 1, 50, undefined, 'shared', 'userA'),
      makeLog('u2', 2, 80, 9000, 'shared', 'userB'),
      makeLog('u2prev', 1, 80, undefined, 'shared', 'userB'),
    ];

    const plan = planOdometerBackfill(logs);

    expect(odoOf(plan, 'u1prev')).toBe(1950); // anchored on userA's 2000
    expect(odoOf(plan, 'u2prev')).toBe(8920); // anchored on userB's 9000
    expect(plan.vehiclesAnchored).toBe(2);
  });

  it('reports vehicles that have no reading to anchor from', () => {
    const logs = [makeLog('a', 1, 100), makeLog('b', 2, 200)];

    const plan = planOdometerBackfill(logs);

    expect(plan.updates).toHaveLength(0);
    expect(plan.skipped).toBe(2);
    expect(plan.vehiclesAnchored).toBe(0);
    expect(plan.vehiclesWithoutAnchor).toBe(1);
  });

  it('stops the backward chain on a missing/invalid distance rather than guessing', () => {
    const logs = [
      makeLog('a', 1, 100),
      makeLog('b', 2, 0), // invalid distance breaks the chain below it
      makeLog('c', 3, 300),
      makeLog('d', 4, 150, 1000), // anchor
    ];

    const plan = planOdometerBackfill(logs);

    expect(odoOf(plan, 'c')).toBe(850); // 1000 - 150
    expect(odoOf(plan, 'b')).toBe(550); // 850 - 300
    expect(odoOf(plan, 'a')).toBeUndefined(); // needs b's distance (0) — invalid
    expect(plan.skipped).toBe(1);
  });

  it('allows a reconstructed reading of exactly zero (brand-new vehicle)', () => {
    const logs = [
      makeLog('a', 1, 100), // earliest fill of a brand-new car
      makeLog('b', 2, 100, 100), // anchor: 100 km on the clock
    ];

    const plan = planOdometerBackfill(logs);

    // a = 100 - 100 = 0, which is a valid reading and must not be skipped.
    expect(odoOf(plan, 'a')).toBe(0);
    expect(plan.skipped).toBe(0);
  });

  it('skips records with a missing or malformed timestamp instead of crashing', () => {
    const good = makeLog('good', 2, 100, 500);
    const broken = { id: 'broken', userId: 'user1', vehicleId: 'car1', distanceKm: 50 } as unknown as BackfillLog;

    const plan = planOdometerBackfill([good, broken]);

    // The broken record is dropped; the good anchor still processes cleanly.
    expect(odoOf(plan, 'broken')).toBeUndefined();
    expect(plan.alreadySet).toBe(1);
  });

  it('does not produce negative odometer readings', () => {
    const logs = [
      makeLog('a', 1, 100),
      makeLog('b', 2, 5000), // huge distance would push a negative
      makeLog('c', 3, 100, 200), // small anchor
    ];

    const plan = planOdometerBackfill(logs);

    expect(odoOf(plan, 'b')).toBe(100); // 200 - 100
    expect(odoOf(plan, 'a')).toBeUndefined(); // 100 - 5000 < 0, rejected
  });
});

describe('summarizeGroups', () => {
  const groupFor = (summaries: ReturnType<typeof summarizeGroups>, vehicleId: string | null) =>
    summaries.find((s) => s.vehicleId === vehicleId);

  it('reports counts, anchor status, and date range per vehicle', () => {
    const logs = [
      makeLog('a', 10, 100, 500, 'car1'),
      makeLog('b', 20, 100, undefined, 'car1'),
      makeLog('c', 30, 100, undefined, 'car2'), // car2 has no reading anywhere
    ];

    const summaries = summarizeGroups(logs);

    const car1 = groupFor(summaries, 'car1')!;
    expect(car1.total).toBe(2);
    expect(car1.withOdometer).toBe(1);
    expect(car1.hasAnchor).toBe(true);
    expect(car1.earliestMillis).toBe(10);
    expect(car1.latestMillis).toBe(20);

    const car2 = groupFor(summaries, 'car2')!;
    expect(car2.total).toBe(1);
    expect(car2.withOdometer).toBe(0);
    expect(car2.hasAnchor).toBe(false);
  });

  it('buckets logs with no vehicleId into a null group', () => {
    // Built directly so vehicleId is genuinely absent (makeLog's default would
    // otherwise replace an explicit undefined with 'car1').
    const logs: BackfillLog[] = [
      { id: 'a', userId: 'user1', timestamp: { toMillis: () => 1 }, distanceKm: 100 },
    ];

    const summaries = summarizeGroups(logs);

    const noVehicle = groupFor(summaries, null)!;
    expect(noVehicle).toBeDefined();
    expect(noVehicle.hasAnchor).toBe(false);
    expect(noVehicle.total).toBe(1);
  });

  it('lists anchorless groups before anchored ones for the same user', () => {
    const logs = [
      makeLog('a', 1, 100, 500, 'anchored'),
      makeLog('b', 2, 100, undefined, 'orphan'),
    ];

    const summaries = summarizeGroups(logs);

    expect(summaries[0].vehicleId).toBe('orphan'); // no anchor first
    expect(summaries[1].vehicleId).toBe('anchored');
  });
});
