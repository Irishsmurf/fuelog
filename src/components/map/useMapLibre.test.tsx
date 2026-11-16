import { render, act } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapInstances, resetMapLibreMock, workerUrls } from '../../test/maplibreMock';
import { MAP_ATTRIBUTION, MAP_MAX_ZOOM, MAP_STYLES, cartoTransformRequest } from '../../utils/mapConstants';

// jsdom has no WebGL, so MapLibre itself is replaced by a recording stub.
vi.mock('maplibre-gl', () => import('../../test/maplibreMock'));

let theme: 'light' | 'dark' = 'light';
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme }),
}));

import { useMapLibre, type MapLibreOptions } from './useMapLibre';

const Harness = (props: Partial<MapLibreOptions>) => {
  const { containerRef, styleGeneration } = useMapLibre({ center: [-6.26, 53.35], zoom: 10, ...props });
  return <div ref={containerRef} data-testid="map" data-generation={styleGeneration} />;
};

describe('useMapLibre', () => {
  beforeEach(() => {
    resetMapLibreMock();
    theme = 'light';
  });

  it('points maplibre at the worker Vite bundles, before any map exists (#247)', () => {
    // Set once, when ./maplibre is first evaluated.
    expect(workerUrls).toHaveLength(1);
    expect(workerUrls[0]).toMatch(/maplibre-gl-worker/);
  });

  it('creates one map in the container with the CARTO basemap', () => {
    const { getByTestId } = render(<Harness />);

    expect(mapInstances).toHaveLength(1);
    expect(mapInstances[0].options).toMatchObject({
      container: getByTestId('map'),
      style: MAP_STYLES.light,
      center: [-6.26, 53.35],
      zoom: 10,
      // A finite maxZoom: vector tiles have none of their own.
      maxZoom: MAP_MAX_ZOOM,
      interactive: true,
      scrollZoom: true,
      transformRequest: cartoTransformRequest,
      attributionControl: { compact: true, customAttribution: MAP_ATTRIBUTION },
    });
  });

  it('passes through a static (non-interactive) map', () => {
    render(<Harness interactive={false} />);
    expect(mapInstances[0].options.interactive).toBe(false);
  });

  it('uses the dark style in dark mode', () => {
    theme = 'dark';
    render(<Harness />);
    expect(mapInstances[0].options.style).toBe(MAP_STYLES.dark);
  });

  it('removes the map on unmount', () => {
    const { unmount } = render(<Harness />);
    unmount();
    expect(mapInstances[0].removed).toBe(true);
  });

  it('leaves exactly one live map under StrictMode double-mounting', () => {
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    expect(mapInstances.filter((m) => !m.removed)).toHaveLength(1);
  });

  it('counts style loads, so callers can re-add their layers', () => {
    const { getByTestId } = render(<Harness />);
    const generation = () => getByTestId('map').getAttribute('data-generation');
    expect(generation()).toBe('0');

    act(() => {
      mapInstances[0].loadStyle();
    });
    expect(generation()).toBe('1');

    act(() => {
      mapInstances[0].loadStyle({ replace: true });
    });
    expect(generation()).toBe('2');
  });

  it('swaps the whole style when the theme changes, without recreating the map', () => {
    const { rerender } = render(<Harness />);
    expect(mapInstances[0].setStyle).not.toHaveBeenCalled();

    theme = 'dark';
    rerender(<Harness />);

    expect(mapInstances).toHaveLength(1);
    // diff: false so 'style.load' fires and layers are re-added.
    expect(mapInstances[0].setStyle).toHaveBeenCalledWith(MAP_STYLES.dark, { diff: false });
  });
});
