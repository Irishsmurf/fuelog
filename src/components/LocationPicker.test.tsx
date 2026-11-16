import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapInstances, markerInstances, resetMapLibreMock } from '../test/maplibreMock';

// jsdom has no WebGL, so MapLibre itself is replaced by a recording stub.
vi.mock('maplibre-gl', () => import('../test/maplibreMock'));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Supports t(key), t(key, opts), t(key, 'default'), and t(key, 'default', opts).
    t: (key: string, defOrOpts?: string | Record<string, unknown>, maybeOpts?: Record<string, unknown>) => {
      let template = key;
      let opts: Record<string, unknown> | undefined;
      if (typeof defOrOpts === 'string') {
        template = defOrOpts;
        opts = maybeOpts;
      } else if (defOrOpts) {
        opts = defOrOpts;
        if ('defaultValue' in defOrOpts) template = String(defOrOpts.defaultValue);
      }
      return opts ? template.replace(/\{\{(\w+)\}\}/g, (_m, n) => String(opts![n] ?? '')) : template;
    },
  }),
}));

const getCurrentPosition = vi.fn();
vi.mock('../utils/locationService', () => ({
  getCurrentPosition: () => getCurrentPosition(),
}));

import LocationPicker from './LocationPicker';

const liveMarkers = () => markerInstances.filter(m => !m.removed && m.map);

describe('LocationPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMapLibreMock();
  });

  it('renders a marker at the provided value and shows its coordinates', () => {
    render(<LocationPicker value={{ latitude: 53.34, longitude: -6.26 }} onChange={vi.fn()} />);
    const markers = liveMarkers();
    expect(markers).toHaveLength(1);
    expect(markers[0].getLngLat()).toEqual({ lng: -6.26, lat: 53.34 });
    expect(markers[0].options.draggable).toBe(true);
    const hint = screen.getByText(/tap or drag the pin to adjust/);
    expect(hint).toHaveTextContent('53.34000');
    expect(hint).toHaveTextContent('-6.26000');
  });

  it('centres on the value, or the default centre when there is none', () => {
    const { unmount } = render(<LocationPicker value={{ latitude: 53.34, longitude: -6.26 }} onChange={vi.fn()} />);
    expect(mapInstances[0].options).toMatchObject({ center: [-6.26, 53.34], zoom: 15 });
    unmount();
    expect(mapInstances[0].removed).toBe(true);

    render(<LocationPicker value={null} defaultCenter={{ latitude: 40, longitude: -70 }} onChange={vi.fn()} />);
    expect(mapInstances[1].options).toMatchObject({ center: [-70, 40], zoom: 11 });
  });

  it('shows the tap-to-place hint and no marker when there is no value', () => {
    render(<LocationPicker value={null} onChange={vi.fn()} />);
    expect(liveMarkers()).toHaveLength(0);
    expect(screen.getByText(/Tap the map to drop a pin/)).toBeInTheDocument();
  });

  it('drops a pin when the map is clicked', () => {
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);
    act(() => {
      mapInstances[0].fire('click', { lngLat: { lat: 1.23, lng: 4.56 } });
    });
    expect(onChange).toHaveBeenCalledWith({ latitude: 1.23, longitude: 4.56 });
  });

  it('calls the latest onChange after a re-render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<LocationPicker value={null} onChange={first} />);
    rerender(<LocationPicker value={null} onChange={second} />);
    act(() => {
      mapInstances[0].fire('click', { lngLat: { lat: 1, lng: 2 } });
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ latitude: 1, longitude: 2 });
  });

  it('updates coordinates when the marker is dragged', () => {
    const onChange = vi.fn();
    render(<LocationPicker value={{ latitude: 1, longitude: 2 }} onChange={onChange} />);
    const [marker] = liveMarkers();
    marker.setLngLat([8, 9]);
    act(() => {
      marker.fire('dragend');
    });
    expect(onChange).toHaveBeenCalledWith({ latitude: 9, longitude: 8 });
  });

  it('moves the pin and recentres when the value changes from outside', () => {
    const { rerender } = render(<LocationPicker value={{ latitude: 1, longitude: 2 }} onChange={vi.fn()} />);
    const map = mapInstances[0];
    map.jumpTo.mockClear();

    rerender(<LocationPicker value={{ latitude: 3, longitude: 4 }} onChange={vi.fn()} />);

    expect(liveMarkers()).toHaveLength(1);
    expect(liveMarkers()[0].getLngLat()).toEqual({ lng: 4, lat: 3 });
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [4, 3], zoom: 15 });
  });

  it('does not recentre when the parent re-renders with equal coordinates', () => {
    const { rerender } = render(<LocationPicker value={{ latitude: 1, longitude: 2 }} onChange={vi.fn()} />);
    const map = mapInstances[0];
    map.jumpTo.mockClear();

    rerender(<LocationPicker value={{ latitude: 1, longitude: 2 }} onChange={vi.fn()} />);

    expect(map.jumpTo).not.toHaveBeenCalled();
  });

  it('removes the pin when the value is cleared', () => {
    const { rerender } = render(<LocationPicker value={{ latitude: 1, longitude: 2 }} onChange={vi.fn()} />);
    rerender(<LocationPicker value={null} onChange={vi.fn()} />);
    expect(liveMarkers()).toHaveLength(0);
  });

  it('uses the current location when the button resolves a position', async () => {
    getCurrentPosition.mockResolvedValue({ latitude: 40, longitude: -70 });
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Use my location/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ latitude: 40, longitude: -70 }));
  });

  it('unmounts cleanly (as when the edit modal closes)', () => {
    const { unmount } = render(<LocationPicker value={{ latitude: 53.3, longitude: -6.2 }} onChange={vi.fn()} />);
    expect(() => unmount()).not.toThrow();
    expect(mapInstances[0].removed).toBe(true);
  });

  it('does not change anything when current location is unavailable', async () => {
    getCurrentPosition.mockResolvedValue(null);
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Use my location/ }));
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });
});
