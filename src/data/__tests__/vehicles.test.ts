import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteDoc, updateDoc } from 'firebase/firestore';
import { addVehicle, deleteVehicle, setDefaultVehicle, toggleArchiveVehicle, type NewVehicleInput } from '../vehicles';
import { countVehicleLogs } from '../logs';
import type { Vehicle } from '../../utils/types';

vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('../../firebase/firestoreService', () => ({ fetchVehicles: vi.fn(), pickDefaultVehicle: vi.fn() }));
vi.mock('../logs', () => ({ countVehicleLogs: vi.fn() }));

const batch = vi.hoisted(() => ({ update: vi.fn(), set: vi.fn(), commit: vi.fn() }));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection: vi.fn(() => ({ path: 'vehicles' })),
    // doc(collectionRef) -> new auto-id ref; doc(db, 'vehicles', id) -> that ref.
    doc: vi.fn((_a: unknown, col?: string, id?: string) => ({ path: col ? `${col}/${id}` : 'vehicles/NEW' })),
    writeBatch: vi.fn(() => batch),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
  };
});

const v = (over: Partial<Vehicle>) => ({ id: 'v1', name: 'Car', isDefault: false, isArchived: false, ...over }) as Vehicle;
const input: NewVehicleInput = { name: 'Van', make: 'Ford', model: 'Transit', year: '2024', fuelType: 'Diesel', isDefault: false };

describe('addVehicle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('makes the first active vehicle the default, in one batch', async () => {
    await addVehicle('u1', input, [v({ id: 'old', isArchived: true })]);
    expect(batch.set).toHaveBeenCalledWith({ path: 'vehicles/NEW' }, { ...input, userId: 'u1', isArchived: false, isDefault: true });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('clears the previous default atomically when the new one is the default', async () => {
    await addVehicle('u1', { ...input, isDefault: true }, [v({ id: 'a', isDefault: true }), v({ id: 'b' })]);
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.update).toHaveBeenCalledWith({ path: 'vehicles/a' }, { isDefault: false });
    expect(batch.set).toHaveBeenCalledWith({ path: 'vehicles/NEW' }, expect.objectContaining({ isDefault: true }));
  });

  it('leaves the existing default alone otherwise', async () => {
    await addVehicle('u1', input, [v({ id: 'a', isDefault: true })]);
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.set).toHaveBeenCalledWith({ path: 'vehicles/NEW' }, expect.objectContaining({ isDefault: false }));
  });
});

describe('setDefaultVehicle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets exactly one default across all vehicles', async () => {
    const all = [v({ id: 'a', isDefault: true }), v({ id: 'b' })];
    await setDefaultVehicle(all[1], all);
    expect(batch.update).toHaveBeenCalledWith({ path: 'vehicles/a' }, { isDefault: false });
    expect(batch.update).toHaveBeenCalledWith({ path: 'vehicles/b' }, { isDefault: true });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('ignores archived vehicles', async () => {
    await setDefaultVehicle(v({ isArchived: true }), [v({ isArchived: true })]);
    expect(batch.commit).not.toHaveBeenCalled();
  });
});

describe('toggleArchiveVehicle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('archiving the default also clears its default flag', async () => {
    await toggleArchiveVehicle(v({ isDefault: true }));
    expect(updateDoc).toHaveBeenCalledWith({ path: 'vehicles/v1' }, { isArchived: true, isDefault: false });
  });

  it('restores an archived vehicle', async () => {
    await toggleArchiveVehicle(v({ isArchived: true }));
    expect(updateDoc).toHaveBeenCalledWith({ path: 'vehicles/v1' }, { isArchived: false });
  });
});

describe('deleteVehicle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses to delete a vehicle that still has logs', async () => {
    vi.mocked(countVehicleLogs).mockResolvedValue(4);
    await expect(deleteVehicle('u1', 'v1')).resolves.toEqual({ deleted: false, logCount: 4 });
    expect(countVehicleLogs).toHaveBeenCalledWith('u1', 'v1');
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('deletes a vehicle with no logs', async () => {
    vi.mocked(countVehicleLogs).mockResolvedValue(0);
    await expect(deleteVehicle('u1', 'v1')).resolves.toEqual({ deleted: true });
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'vehicles/v1' });
  });
});
