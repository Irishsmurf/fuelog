import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the map click handler registered via useMapEvents so tests can
// simulate tapping the map to drop a pin.
let capturedClick: ((e: { latlng: { lat: number; lng: number } }) => void) | undefined;
const setView = vi.fn();

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => <div data-testid="tile" />,
  Marker: ({ position, eventHandlers }: { position: [number, number]; eventHandlers?: { dragend?: (e: unknown) => void } }) => (
    <div
      data-testid="marker"
      data-pos={JSON.stringify(position)}
      onClick={() => eventHandlers?.dragend?.({ target: { getLatLng: () => ({ lat: 9, lng: 8 }) } })}
    />
  ),
  useMap: () => ({ setView, getZoom: () => 13 }),
  useMapEvents: (handlers: { click: (e: { latlng: { lat: number; lng: number } }) => void }) => {
    capturedClick = handlers.click;
    return null;
  },
}));

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

describe('LocationPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedClick = undefined;
  });

  it('renders a marker at the provided value and shows its coordinates', () => {
    render(<LocationPicker value={{ latitude: 53.34, longitude: -6.26 }} onChange={vi.fn()} />);
    const marker = screen.getByTestId('marker');
    expect(JSON.parse(marker.getAttribute('data-pos')!)).toEqual([53.34, -6.26]);
    const hint = screen.getByText(/tap or drag the pin to adjust/);
    expect(hint).toHaveTextContent('53.34000');
    expect(hint).toHaveTextContent('-6.26000');
  });

  it('shows the tap-to-place hint and no marker when there is no value', () => {
    render(<LocationPicker value={null} onChange={vi.fn()} />);
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
    expect(screen.getByText(/Tap the map to drop a pin/)).toBeInTheDocument();
  });

  it('drops a pin when the map is clicked', () => {
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);
    expect(capturedClick).toBeDefined();
    capturedClick!({ latlng: { lat: 1.23, lng: 4.56 } });
    expect(onChange).toHaveBeenCalledWith({ latitude: 1.23, longitude: 4.56 });
  });

  it('updates coordinates when the marker is dragged', () => {
    const onChange = vi.fn();
    render(<LocationPicker value={{ latitude: 1, longitude: 2 }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('marker')); // mock maps click -> dragend
    expect(onChange).toHaveBeenCalledWith({ latitude: 9, longitude: 8 });
  });

  it('uses the current location when the button resolves a position', async () => {
    getCurrentPosition.mockResolvedValue({ latitude: 40, longitude: -70 });
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Use my location/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ latitude: 40, longitude: -70 }));
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
