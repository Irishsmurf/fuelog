import { render, screen, fireEvent } from '@testing-library/react';
import LogCard from './LogCard';
import { describe, it, expect, vi } from 'vitest';


// Mock react-i18next so tests don't need a real i18n instance
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const strings: Record<string, string> = {
        'logCard.distance': 'Distance',
        'logCard.fuelAdded': 'Fuel Added',
        'logCard.mpg': 'MPG',
        'logCard.kmL': 'km/L',
        'logCard.l100km': 'L/100km',
        'logCard.costPerMile': 'Cost/Mile',
        'logCard.receipt': 'Receipt',
        'logCard.tapToViewMap': 'Tap to view map',
        'logCard.noLocation': 'No location',
        'logCard.unknownStation': 'Unknown Station',
        'logCard.editEntry': 'Edit Entry',
        'logCard.deleteEntry': 'Delete Entry',
      };
      return strings[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    profile: { homeCurrency: 'EUR' }
  })
}));

// Mock react-leaflet to avoid map rendering issues in tests
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div />,
  Marker: () => <div />,
  useMap: () => ({
    invalidateSize: vi.fn(),
    setView: vi.fn()
  })
}));

// Mock the Log type structure needed for the component
const mockLog = {
  id: '1',
  userId: 'user1',
  timestamp: {
    toDate: () => new Date('2023-01-01T12:00:00')
  } as any,
  brand: 'Test Brand',
  cost: 50,
  distanceKm: 100,
  fuelAmountLiters: 10,
};

describe('LogCard', () => {
  it('renders log details correctly', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<LogCard log={mockLog} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getAllByText('Test Brand').length).toBeGreaterThan(0);
    
    // Check for the new labels
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByText('100.0 Km')).toBeInTheDocument();

    expect(screen.getByText('Fuel Added')).toBeInTheDocument();
    expect(screen.getByText('10.00 L')).toBeInTheDocument();

    expect(screen.getByText('MPG')).toBeInTheDocument();
    expect(screen.getByText('28.25')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<LogCard log={mockLog} onEdit={onEdit} onDelete={onDelete} />);

    const editButton = screen.getByTitle('Edit Entry');
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(mockLog);
  });

  it('calls onDelete when delete button is clicked', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<LogCard log={mockLog} onEdit={onEdit} onDelete={onDelete} />);

    const deleteButton = screen.getByTitle('Delete Entry');
    fireEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(mockLog.id);
  });
});
