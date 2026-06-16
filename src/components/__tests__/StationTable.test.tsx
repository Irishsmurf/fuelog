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
        'stationTable.name': 'Name',
        'stationTable.brand': 'Brand',
        'stationTable.avgPrice': 'Avg. Price',
        'stationTable.logCount': 'Logs',
        'stationTable.unknownBrand': 'Unknown Brand',
        'stationTable.noData': 'N/A',
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

  it('renders table headers correctly', () => {
    render(<StationTable stations={[]} onSelectStation={onSelectStation} selectedStationId={null} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Brand')).toBeInTheDocument();
    expect(screen.getByText('Avg. Price')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('renders station data correctly', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);

    expect(screen.getByText('Shell A')).toBeInTheDocument();
    expect(screen.getByText('Shell')).toBeInTheDocument();
    expect(screen.getByText('€1.450/L')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();

    expect(screen.getByText('Maxol B')).toBeInTheDocument();
    expect(screen.getByText('Maxol')).toBeInTheDocument();
    expect(screen.getByText('€1.550/L')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    
    expect(screen.getByText('NoBrand C')).toBeInTheDocument();
    expect(screen.getByText('Unknown Brand')).toBeInTheDocument(); // Checks for unknown brand translation
    expect(screen.getByText('€1.350/L')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('calls onSelectStation when a row is clicked', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);
    fireEvent.click(screen.getByText('Shell A'));
    expect(onSelectStation).toHaveBeenCalledWith('station1');
  });

  it('highlights the selected station', () => {
    const { rerender } = render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);
    
    expect(screen.getByText('Shell A').closest('tr')).not.toHaveClass('bg-indigo-50');

    rerender(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={'station1'} />);
    expect(screen.getByText('Shell A').closest('tr')).toHaveClass('bg-indigo-50');
  });

  it('sorts by name in ascending and descending order', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);
    
    // Initial order (as per mockStations)
    let rows = screen.getAllByRole('row').slice(1).map(row => row.children[0].textContent);
    expect(rows).toEqual(['Shell A', 'Maxol B', 'NoBrand C']);

    // Sort by Name Ascending
    fireEvent.click(screen.getByText('Name'));
    rows = screen.getAllByRole('row').slice(1).map(row => row.children[0].textContent);
    expect(rows).toEqual(['Maxol B', 'NoBrand C', 'Shell A']);

    // Sort by Name Descending
    fireEvent.click(screen.getByText('Name'));
    rows = screen.getAllByRole('row').slice(1).map(row => row.children[0].textContent);
    expect(rows).toEqual(['Shell A', 'NoBrand C', 'Maxol B']);
  });

  it('sorts by Avg. Price in ascending and descending order', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);
    
    // Sort by Avg. Price Ascending
    fireEvent.click(screen.getByText('Avg. Price'));
    let rows = screen.getAllByRole('row').slice(1).map(row => row.children[0].textContent);
    expect(rows).toEqual(['NoBrand C', 'Shell A', 'Maxol B']); // 1.35, 1.45, 1.55

    // Sort by Avg. Price Descending
    fireEvent.click(screen.getByText('Avg. Price'));
    rows = screen.getAllByRole('row').slice(1).map(row => row.children[0].textContent);
    expect(rows).toEqual(['Maxol B', 'Shell A', 'NoBrand C']); // 1.55, 1.45, 1.35
  });

  it('sorts by Logs count in ascending and descending order', () => {
    render(<StationTable stations={mockStations} onSelectStation={onSelectStation} selectedStationId={null} />);
    
    // Sort by Logs Ascending
    fireEvent.click(screen.getByText('Logs'));
    let rows = screen.getAllByRole('row').slice(1).map(row => row.children[0].textContent);
    expect(rows).toEqual(['Maxol B', 'Shell A', 'NoBrand C']); // 5, 10, 15

    // Sort by Logs Descending
    fireEvent.click(screen.getByText('Logs'));
    rows = screen.getAllByRole('row').slice(1).map(row => row.children[0].textContent);
    expect(rows).toEqual(['NoBrand C', 'Shell A', 'Maxol B']); // 15, 10, 5
  });
});
