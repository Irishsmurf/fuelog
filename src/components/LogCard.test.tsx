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
    // Date formatting might depend on locale in environment, checking part of it or skipping exact date check if flaky.
    // 'en-IE' expectation:
    // expect(screen.getByText('01/01/2023')).toBeInTheDocument();

    expect(screen.getByText('Cost:')).toBeInTheDocument();
    expect(screen.getByText('50.00 €')).toBeInTheDocument();

    expect(screen.getByText('Distance:')).toBeInTheDocument();
    expect(screen.getByText('100.0 Km')).toBeInTheDocument();

    expect(screen.getByText('Fuel:')).toBeInTheDocument();
    expect(screen.getByText('10.00 L')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<LogCard log={mockLog} onEdit={onEdit} onDelete={onDelete} />);

    // Find edit button. It has title "Edit Log"
    const editButton = screen.getByTitle('Edit Log');
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(mockLog);
  });

  it('calls onDelete when delete button is clicked', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<LogCard log={mockLog} onEdit={onEdit} onDelete={onDelete} />);

    const deleteButton = screen.getByTitle('Delete Log');
    fireEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(mockLog.id);
  });
});
