import { render, screen, fireEvent } from '@testing-library/react';
import LogCard from './LogCard';
import { describe, it, expect, vi } from 'vitest';

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

    expect(screen.getByText('Test Brand')).toBeInTheDocument();
    
    // Check for the new labels (no colon, uppercase in CSS but text content is as written)
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

    // Find edit button. It has title "Edit Entry"
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
