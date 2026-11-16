import { render, screen, fireEvent } from '@testing-library/react';
import LogCard from './LogCard';
import { describe, it, expect, vi } from 'vitest';
import type { Log } from '../utils/types';
import { Timestamp } from 'firebase/firestore';


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
        'logCard.unknownStation': 'Unknown Station',
        'logCard.editEntry': 'Edit Entry',
        'logCard.deleteEntry': 'Delete Entry',
        'logCard.closeReceipt': 'Close',
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

// Mock the Log type structure needed for the component
const mockLog: Log = {
  id: '1',
  userId: 'user1',
  timestamp: Timestamp.fromDate(new Date('2023-01-01T12:00:00')),
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

  it('keeps the receipt thumbnail clipped within the card boundary (#162)', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const logWithReceipt: Log = { ...mockLog, receiptUrl: 'https://example.com/receipt.jpg' };

    render(<LogCard log={logWithReceipt} onEdit={onEdit} onDelete={onDelete} />);

    const receiptImg = screen.getByAltText('Receipt');
    expect(receiptImg).toBeInTheDocument();

    // The front face must clip any overflowing content (e.g. the receipt
    // thumbnail) instead of letting it spill outside the card's rounded
    // boundary, which is what caused #162.
    const cardBody = receiptImg.closest('[data-testid="log-card-body"]');
    expect(cardBody).toHaveClass('overflow-y-auto');
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

  // The flip-to-map thumbnail was dropped with the move to MapLibre only
  // (rewrite step 5): one WebGL context per card does not scale to a list.
  describe('without a map thumbnail', () => {
    const logWithGeo: Log = { ...mockLog, latitude: 51.5, longitude: -0.1 };

    it('stays on the log details when a geotagged card is tapped', () => {
      const { container } = render(<LogCard log={logWithGeo} onEdit={vi.fn()} onDelete={vi.fn()} />);
      const card = container.firstChild as HTMLElement;

      fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
      fireEvent.click(card, { clientX: 100, clientY: 100 });

      expect(screen.getByText('Distance')).toBeVisible();
      expect(container.querySelector('.maplibregl-map, .leaflet-container')).toBeNull();
      expect(container.querySelector('.rotate-y-180')).toBeNull();
    });

    it('still lets a tall card scroll its own content (#162)', () => {
      render(<LogCard log={logWithGeo} onEdit={vi.fn()} onDelete={vi.fn()} />);

      expect(screen.getByTestId('log-card-body')).toHaveClass('overflow-y-auto');
    });
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

  it('opens the receipt in a modal instead of navigating away when the thumbnail is clicked', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const logWithReceipt: Log = { ...mockLog, receiptUrl: 'https://example.com/receipt.jpg' };

    render(<LogCard log={logWithReceipt} onEdit={onEdit} onDelete={onDelete} />);

    // The thumbnail should not be a link that navigates away from the app.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    fireEvent.click(screen.getByAltText('Receipt'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getAllByAltText('Receipt')).toHaveLength(2); // thumbnail + enlarged image

    fireEvent.click(screen.getByLabelText('Close'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

