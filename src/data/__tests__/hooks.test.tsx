import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAddLog, useDeleteLog, useUpdateLog } from '../logHooks';
import { useAddVehicle, useDeleteVehicle, useToggleArchiveVehicle } from '../vehicleHooks';
import { logKeys, vehicleKeys } from '../keys';
import { addLog, deleteLog, updateLog } from '../logs';
import { addVehicle, deleteVehicle, toggleArchiveVehicle } from '../vehicles';
import type { Vehicle } from '../../utils/types';

vi.mock('../../firebase/config', () => ({ db: {}, auth: {} }));
vi.mock('../logs', () => ({
  addLog: vi.fn(), updateLog: vi.fn(), deleteLog: vi.fn(), fetchLogsSince: vi.fn(), fetchRecentBrands: vi.fn(),
}));
vi.mock('../vehicles', () => ({
  addVehicle: vi.fn(), deleteVehicle: vi.fn(), setDefaultVehicle: vi.fn(), toggleArchiveVehicle: vi.fn(), fetchVehicles: vi.fn(),
}));
vi.mock('../../firebase/firestoreService', () => ({ getLastOdometerReading: vi.fn() }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, invalidate, wrapper };
}

const invalidatedKeys = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(c => (c[0] as { queryKey: unknown[] }).queryKey);

describe('log mutations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adding a log invalidates every log query for the user', async () => {
    vi.mocked(addLog).mockResolvedValue({ savedOffline: false });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useAddLog('u1'), { wrapper });
    await act(() => result.current.mutateAsync({} as never));
    expect(invalidatedKeys(invalidate)).toEqual([logKeys.all('u1')]);
  });

  it('marks History lists, stats and dashboard data stale', async () => {
    vi.mocked(updateLog).mockResolvedValue();
    const { client, wrapper } = setup();
    const keys = [
      logKeys.list('u1', {}), logKeys.lifetimeStats('u1', undefined), logKeys.since('u1', 0, undefined),
      logKeys.recentBrands('u1'), logKeys.vehicleComparison('u1', ['a', 'b']),
    ];
    keys.forEach(k => client.setQueryData(k, 'cached'));
    client.setQueryData(vehicleKeys.list('u1', false), 'cached');
    client.setQueryData(logKeys.list('other', {}), 'cached');

    const { result } = renderHook(() => useUpdateLog('u1'), { wrapper });
    await act(() => result.current.mutateAsync({ logId: 'l1', updates: { cost: 1 } }));

    keys.forEach(k => expect(client.getQueryState(k)?.isInvalidated).toBe(true));
    expect(client.getQueryState(vehicleKeys.list('u1', false))?.isInvalidated).toBe(false);
    expect(client.getQueryState(logKeys.list('other', {}))?.isInvalidated).toBe(false);
    expect(updateLog).toHaveBeenCalledWith('l1', { cost: 1 });
  });

  it('deleting a log invalidates log queries', async () => {
    vi.mocked(deleteLog).mockResolvedValue();
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useDeleteLog('u1'), { wrapper });
    await act(() => result.current.mutateAsync('l1'));
    expect(invalidatedKeys(invalidate)).toEqual([logKeys.all('u1')]);
  });

  it('does not invalidate when the write fails', async () => {
    vi.mocked(addLog).mockRejectedValue(new Error('denied'));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useAddLog('u1'), { wrapper });
    await act(() => result.current.mutateAsync({} as never).catch(() => {}));
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('vehicle mutations', () => {
  beforeEach(() => vi.clearAllMocks());
  const car = { id: 'v1' } as Vehicle;

  it('adding or archiving a vehicle invalidates the vehicle lists', async () => {
    vi.mocked(addVehicle).mockResolvedValue();
    vi.mocked(toggleArchiveVehicle).mockResolvedValue();
    const { invalidate, wrapper } = setup();
    const add = renderHook(() => useAddVehicle('u1'), { wrapper });
    await act(() => add.result.current.mutateAsync({ input: {} as never, existing: [] }));
    const archive = renderHook(() => useToggleArchiveVehicle('u1'), { wrapper });
    await act(() => archive.result.current.mutateAsync(car));
    expect(invalidatedKeys(invalidate)).toEqual([vehicleKeys.all('u1'), vehicleKeys.all('u1')]);
    expect(addVehicle).toHaveBeenCalledWith('u1', {}, []);
  });

  it('a refused delete (vehicle has logs) changes nothing, so nothing is invalidated', async () => {
    vi.mocked(deleteVehicle).mockResolvedValueOnce({ deleted: false, logCount: 2 }).mockResolvedValueOnce({ deleted: true });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useDeleteVehicle('u1'), { wrapper });
    await act(() => result.current.mutateAsync('v1'));
    expect(invalidate).not.toHaveBeenCalled();
    await act(() => result.current.mutateAsync('v1'));
    await waitFor(() => expect(invalidatedKeys(invalidate)).toEqual([vehicleKeys.all('u1')]));
  });
});
