import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { FeatureCollection } from 'geojson';
import type { Log, Station } from '../utils/types';
import { mapInstances, markerInstances, popupInstances, resetMapLibreMock, type MockMap } from '../test/maplibreMock';

// jsdom has no WebGL, so MapLibre itself is replaced by a recording stub.
vi.mock('maplibre-gl', () => import('../test/maplibreMock'));

// jsdom never decodes images, so register the station icons directly.
vi.mock('./map/styleHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./map/styleHelpers')>();
  return {
    ...actual,
    addStationImages: vi.fn(async (map: MockMap) => {
      map.addImage(actual.STATION_IMAGE);
      map.addImage(actual.UNASSIGNED_STATION_IMAGE);
    }),
  };
});

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('../hooks/useHomeCurrency', () => ({ useHomeCurrency: () => ({ code: 'EUR', symbol: '€' }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defOrOpts?: string | Record<string, unknown>, maybeOpts?: Record<string, unknown>) => {
      const opts = typeof defOrOpts === 'object' ? defOrOpts : maybeOpts;
      const template = typeof defOrOpts === 'string' ? defOrOpts : key;
      const filled = opts ? template.replace(/\{\{(\w+)\}\}/g, (_m, n) => String(opts[n] ?? '')) : template;
      return opts && 'count' in opts ? `${filled}:${opts.count}` : filled;
    },
  }),
}));

const fetchFuelLocations = vi.fn();
const fetchUserStations = vi.fn();
vi.mock('../firebase/firestoreService', () => ({
  fetchFuelLocations: () => fetchFuelLocations(),
  fetchUserStations: (logs: Log[]) => fetchUserStations(logs),
}));

import FuelMapPage from './FuelMapPage';

const log = (id: string, extra: Partial<Log>): Log => ({
  id,
  userId: 'u1',
  timestamp: Timestamp.fromDate(new Date('2024-03-01T12:00:00')),
  brand: 'Brand',
  cost: 60,
  distanceKm: 500,
  fuelAmountLiters: 40,
  ...extra,
});

const shell: Station = {
  id: 'st1',
  osmId: 'node/1',
  name: 'Shell Ranelagh',
  latitude: 53.32,
  longitude: -6.25,
  logCount: 2,
  avgPrice: 1.789,
};

const logs: Log[] = [
  log('a', { stationId: 'st1', latitude: 53.3201, longitude: -6.2501 }),
  log('b', { stationId: 'st1', latitude: 53.3202, longitude: -6.2502 }),
  log('c', { brand: 'Roadside', latitude: 52.66, longitude: -8.63 }),
  log('d', {}), // no coordinates: not on the map
];

const renderLoaded = async () => {
  render(<FuelMapPage />);
  await waitFor(() => expect(mapInstances).toHaveLength(1));
  const map = mapInstances[0];
  await act(async () => {
    map.loadStyle();
  });
  return map;
};

const stationFeatures = (map: MockMap) =>
  (map.getSource('fuelog-stations')!.data as FeatureCollection).features;

describe('FuelMapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMapLibreMock();
    fetchFuelLocations.mockResolvedValue(logs);
    fetchUserStations.mockResolvedValue([shell]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('groups logs by station into a clustered GeoJSON source', async () => {
    const map = await renderLoaded();

    const source = map.getSource('fuelog-stations')!;
    expect(source.spec).toMatchObject({ type: 'geojson', cluster: true });

    const features = stationFeatures(map);
    expect(features).toHaveLength(2);
    const station = features.find(f => f.properties!.key === 'station-st1')!;
    // Plotted at the station's stored position, not a log's GPS reading.
    expect(station.geometry).toEqual({ type: 'Point', coordinates: [-6.25, 53.32] });
    expect(station.properties!.unassigned).toBe(false);
    const unassigned = features.find(f => f.properties!.key !== 'station-st1')!;
    expect(unassigned.properties!.unassigned).toBe(true);
    expect(unassigned.geometry).toEqual({ type: 'Point', coordinates: [-8.63, 52.66] });
  });

  it('adds cluster, count and station layers, with the count in a font the basemap serves', async () => {
    const map = await renderLoaded();

    expect(map.getLayer('fuelog-clusters')).toMatchObject({ type: 'circle', filter: ['has', 'point_count'] });
    expect(map.getLayer('fuelog-cluster-count')).toMatchObject({
      type: 'symbol',
      layout: expect.objectContaining({ 'text-font': ['Open Sans Regular'] }),
    });
    await waitFor(() => expect(map.getLayer('fuelog-station-points')).toBeDefined());
    expect(map.getLayer('fuelog-station-points')).toMatchObject({
      type: 'symbol',
      filter: ['!', ['has', 'point_count']],
    });
  });

  it('skips the count labels rather than guessing a font when the basemap has none', async () => {
    render(<FuelMapPage />);
    await waitFor(() => expect(mapInstances).toHaveLength(1));
    const map = mapInstances[0];
    map.styleLayers = [];
    await act(async () => {
      map.loadStyle();
    });

    expect(map.getLayer('fuelog-clusters')).toBeDefined();
    expect(map.getLayer('fuelog-cluster-count')).toBeUndefined();
  });

  it('toggles between clusters and a native heatmap layer', async () => {
    const map = await renderLoaded();
    await waitFor(() => expect(map.getLayer('fuelog-station-points')).toBeDefined());

    const heat = map.getSource('fuelog-heat')!;
    expect((heat.data as FeatureCollection).features).toHaveLength(3);
    expect(map.getLayer('fuelog-heatmap')).toMatchObject({ type: 'heatmap', source: 'fuelog-heat' });
    expect(map.getLayoutProperty('fuelog-heatmap', 'visibility')).toBe('none');
    expect(map.getLayoutProperty('fuelog-clusters', 'visibility')).toBe('visible');

    fireEvent.click(screen.getByRole('button', { name: /Heatmap/ }));

    expect(map.getLayoutProperty('fuelog-heatmap', 'visibility')).toBe('visible');
    for (const id of ['fuelog-clusters', 'fuelog-cluster-count', 'fuelog-station-points']) {
      expect(map.getLayoutProperty(id, 'visibility')).toBe('none');
    }

    fireEvent.click(screen.getByRole('button', { name: /Clusters/ }));
    expect(map.getLayoutProperty('fuelog-heatmap', 'visibility')).toBe('none');
    expect(map.getLayoutProperty('fuelog-clusters', 'visibility')).toBe('visible');
  });

  it('opens a popup with the station and its recent fills when a station is clicked', async () => {
    const map = await renderLoaded();

    act(() => {
      map.fire('click', { features: [{ properties: { key: 'station-st1' } }] }, 'fuelog-station-points');
    });

    expect(popupInstances).toHaveLength(1);
    expect(popupInstances[0].lngLat).toEqual([-6.25, 53.32]);
    expect(await screen.findByText('Shell Ranelagh')).toBeInTheDocument();
    expect(screen.getByText('Avg: €1.789/L')).toBeInTheDocument();
    expect(screen.getAllByText('€60.00')).toHaveLength(2);
    expect(screen.getByText('map.fuelingsAtStation:2')).toBeInTheDocument();
  });

  it('flags a log with no station as an unassigned location', async () => {
    const map = await renderLoaded();
    const key = stationFeatures(map).find(f => f.properties!.unassigned)!.properties!.key;

    act(() => {
      map.fire('click', { features: [{ properties: { key } }] }, 'fuelog-station-points');
    });

    expect(await screen.findByText('Roadside')).toBeInTheDocument();
    expect(screen.getByText('common.unassignedLocation')).toBeInTheDocument();
  });

  it('closes the popup when switching to the heatmap', async () => {
    const map = await renderLoaded();
    act(() => {
      map.fire('click', { features: [{ properties: { key: 'station-st1' } }] }, 'fuelog-station-points');
    });
    expect(await screen.findByText('Shell Ranelagh')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Heatmap/ }));

    expect(popupInstances[0].isOpen).toBe(false);
    expect(screen.queryByText('Shell Ranelagh')).not.toBeInTheDocument();
  });

  it('zooms into a cluster when it is clicked', async () => {
    const map = await renderLoaded();

    await act(async () => {
      await Promise.all(map.fire(
        'click',
        { features: [{ geometry: { type: 'Point', coordinates: [-6.2, 53.3] }, properties: { cluster_id: 7 } }] },
        'fuelog-clusters',
      ));
    });

    expect(map.getSource('fuelog-stations')!.getClusterExpansionZoom).toHaveBeenCalledWith(7);
    expect(map.easeTo).toHaveBeenCalledWith({ center: [-6.2, 53.3], zoom: 12 });
  });

  it('re-adds its layers and data after the theme swaps the basemap style', async () => {
    const map = await renderLoaded();
    await waitFor(() => expect(map.getLayer('fuelog-station-points')).toBeDefined());

    await act(async () => {
      map.loadStyle({ replace: true });
    });

    expect(map.getLayer('fuelog-clusters')).toBeDefined();
    expect(map.getLayer('fuelog-heatmap')).toBeDefined();
    expect(stationFeatures(map)).toHaveLength(2);
    await waitFor(() => expect(map.getLayer('fuelog-station-points')).toBeDefined());
  });

  it('frames the logs and puts the zoom control bottom-left', async () => {
    const map = await renderLoaded();

    expect(map.options).toMatchObject({ center: [-6.2501, 53.3201], zoom: 10 });
    expect(map.controls.map(c => c.position)).toEqual(['bottom-left']);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    const [bounds] = map.fitBounds.mock.calls[0] as unknown as [{ sw: number[]; ne: number[] }];
    expect(bounds.sw).toEqual([-8.63, 52.66]);
    expect(bounds.ne).toEqual([-6.2501, 53.3202]);
  });

  it('centres on Dublin with a notice when no log has a location', async () => {
    fetchFuelLocations.mockResolvedValue([log('d', {})]);
    fetchUserStations.mockResolvedValue([]);
    render(<FuelMapPage />);

    expect(await screen.findByText('No fuel logs with location data found.')).toBeInTheDocument();
    expect(mapInstances[0].options).toMatchObject({ center: [-6.2603, 53.3498], zoom: 6 });
    expect(mapInstances[0].fitBounds).not.toHaveBeenCalled();
  });

  it('shows an error when the logs fail to load', async () => {
    fetchFuelLocations.mockRejectedValue(new Error('nope'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<FuelMapPage />);

    expect(await screen.findByText('Failed to load map data.')).toBeInTheDocument();
    expect(mapInstances).toHaveLength(0);
  });

  it('locates the user, marks the spot and flies there', async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({ coords: { latitude: 51.9, longitude: -8.47 } } as GeolocationPosition));
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });
    try {
      const map = await renderLoaded();

      fireEvent.click(screen.getByTitle('Locate Me'));

      expect(getCurrentPosition).toHaveBeenCalled();
      const marker = markerInstances[markerInstances.length - 1];
      expect(marker.getLngLat()).toEqual({ lng: -8.47, lat: 51.9 });
      expect(marker.popup?.text).toBe('You are here');
      expect(map.flyTo).toHaveBeenCalledWith({ center: [-8.47, 51.9], zoom: 14 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('removes the map when the page unmounts', async () => {
    const { unmount } = render(<FuelMapPage />);
    await waitFor(() => expect(mapInstances).toHaveLength(1));
    unmount();
    expect(mapInstances[0].removed).toBe(true);
  });
});
