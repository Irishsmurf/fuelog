// src/components/__tests__/StationTable.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StationTable from '../StationTable';
import { Station } from '../../utils/types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'stationTable.sortBy': 'Sort by',
        'stationTable.name': 'Name',
        'stationTable.brand': 'Brand',
        'stationTable.avgPrice': 'Avg. Price',
        'stationTable.logCount': 'Logs',
        'stationTable.unknownBrand': 'Unknown Brand',
        'stationTable.noData': 'N/A',
        'stationTable.distance': 'Distance',
      };
      return translations[key] || key;
    },
  }),
}));

const mockStations: Station[] = [
  {
    id: 'station1',
    osmId: 'osm1',
    name: 'Shell A',
    brand: 'Shell',
    latitude: 10,
    longitude: 20,
    lastPrice: 1.5,
    avgPrice: 1.45,
    logCount: 10,
  },
  {
    id: 'station2',
    osmId: 'osm2',
    name: 'Maxol B',
    brand: 'Maxol',
    latitude: 11,
    longitude: 21,
    lastPrice: 1.6,
    avgPrice: 1.55,
    logCount: 5,
  },
  {
    id: 'station3',
    osmId: 'osm3',
    name: 'NoBrand C',
    brand: undefined,
    latitude: 12,
    longitude: 22,
    lastPrice: 1.4,
    avgPrice: 1.35,
    logCount: 15,
  },
];

describe('StationTable', () => {
  const onSelectStation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sort controls', () => {
    render(<StationTable stations={[]} onSelectStation={onSelectStation} selectedStationId={null} />);
    expect(screen.getByText('Sort by')).toBeInTheDocument();
    expect(screen.getByTestId('sort-name')).toBeInTheDocument();
    expect(screen.getByTestId('sort-avgPrice')).toBeInTheDocument();
    expect(screen.getByTestId('sort-logCount')).toBeInTheDocument();
  });

  it('renders station data correctly', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);

    expect(screen.getByText('Shell A')).toBeInTheDocument();
    expect(screen.getByText(/Shell ·/)).toBeInTheDocument();
    expect(screen.getByText('€1.450/L')).toBeInTheDocument();

    expect(screen.getByText('Maxol B')).toBeInTheDocument();
    expect(screen.getByText(/Maxol ·/)).toBeInTheDocument();
    expect(screen.getByText('€1.550/L')).toBeInTheDocument();

    expect(screen.getByText('NoBrand C')).toBeInTheDocument();
    expect(screen.getByText(/Unknown Brand ·/)).toBeInTheDocument(); // Checks for unknown brand translation
    expect(screen.getByText('€1.350/L')).toBeInTheDocument();
  });

  it('calls onSelectStation when a row is clicked', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);
    fireEvent.click(screen.getByText('Shell A'));
    expect(onSelectStation).toHaveBeenCalledWith('station1');
  });

  it('highlights the selected station', () => {
    const { rerender } = render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);

    expect(screen.getByText('Shell A').closest('button')).not.toHaveAttribute('aria-current', 'true');

    rerender(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={'station1'} />);
    expect(screen.getByText('Shell A').closest('button')).toHaveAttribute('aria-current', 'true');
  });

  const orderedNames = () =>
    screen.getAllByRole('listitem').map((li) => li.querySelector('span.block.font-medium')?.textContent);

  it('sorts by name in ascending and descending order', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);

    expect(orderedNames()).toEqual(['Shell A', 'Maxol B', 'NoBrand C']);

    fireEvent.click(screen.getByTestId('sort-name'));
    expect(orderedNames()).toEqual(['Maxol B', 'NoBrand C', 'Shell A']);

    fireEvent.click(screen.getByTestId('sort-name'));
    expect(orderedNames()).toEqual(['Shell A', 'NoBrand C', 'Maxol B']);
  });

  it('sorts by Avg. Price in ascending and descending order', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);

    fireEvent.click(screen.getByTestId('sort-avgPrice'));
    expect(orderedNames()).toEqual(['NoBrand C', 'Shell A', 'Maxol B']); // 1.35, 1.45, 1.55

    fireEvent.click(screen.getByTestId('sort-avgPrice'));
    expect(orderedNames()).toEqual(['Maxol B', 'Shell A', 'NoBrand C']); // 1.55, 1.45, 1.35
  });

  it('sorts by Logs count in ascending and descending order', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);

    fireEvent.click(screen.getByTestId('sort-logCount'));
    expect(orderedNames()).toEqual(['Maxol B', 'Shell A', 'NoBrand C']); // 5, 10, 15

    fireEvent.click(screen.getByTestId('sort-logCount'));
    expect(orderedNames()).toEqual(['NoBrand C', 'Shell A', 'Maxol B']); // 15, 10, 5
  });

  it('does not show a Distance sort option when no origin is provided', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);
    expect(screen.queryByTestId('sort-distance')).not.toBeInTheDocument();
  });

  it('defaults to nearest-first distance sort when an origin is provided', () => {
    // Origin near station2 (11, 21); station1 (10,20) and station3 (12,22) are
    // roughly equidistant on either side, so station2 should sort first.
    render(
      <StationTable
        stations={mockStations}
        onSelectStation={onSelectStation}
        selectedStationId={null}
        origin={{ latitude: 11, longitude: 21 }}
      />
    );

    expect(screen.getByTestId('sort-distance')).toBeInTheDocument();
    expect(screen.getByTestId('sort-distance')).toHaveAttribute('aria-pressed', 'true');
    expect(orderedNames()[0]).toEqual('Maxol B');
  });

  it('toggles distance sort direction on click', () => {
    render(
      <StationTable
        stations={mockStations}
        onSelectStation={onSelectStation}
        selectedStationId={null}
        origin={{ latitude: 11, longitude: 21 }}
      />
    );

    const nearestFirst = orderedNames();
    fireEvent.click(screen.getByTestId('sort-distance'));
    const farthestFirst = orderedNames();
    expect(farthestFirst).toEqual([...nearestFirst].reverse());
  });
});
