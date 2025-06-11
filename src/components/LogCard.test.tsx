// src/components/LogCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'; // Added fireEvent
import '@testing-library/jest-dom';
import LogCard from './LogCard';
import { Log } from '../utils/types'; // Import the shared Log type
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

const mockLog: Log = {
  id: 'log1',
  userId: 'user1',
  timestamp: Timestamp.now(), // Use actual Timestamp for type correctness
  brand: 'Shell',
  cost: 50,
  distanceKm: 300,
  fuelAmountLiters: 40,
  // vehicleId: 'v1' // Not strictly needed for these specific tests, but good for full Log object
};

const mockOnEdit = jest.fn();
const mockOnDelete = jest.fn();

describe('LogCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders basic log information correctly', () => {
    render(<LogCard log={mockLog} onEdit={mockOnEdit} onDelete={mockOnDelete} />);
    expect(screen.getByText('Shell')).toBeInTheDocument();
    // Check for a few other key elements to ensure basic rendering
    expect(screen.getByText(/cost/i)).toBeInTheDocument();
    // Note: The component formats numbers, so check for the formatted string
    expect(screen.getByText((content, _element) => content.includes('50.00') && content.includes('€'))).toBeInTheDocument();
  });

  it('displays the vehicle name when vehicleName prop is provided', () => {
    const vehicleName = 'My Test Car';
    render(<LogCard log={mockLog} vehicleName={vehicleName} onEdit={mockOnEdit} onDelete={mockOnDelete} />);
    // The text is expected to be like "Vehicle: My Test Car"
    expect(screen.getByText(`Vehicle: ${vehicleName}`)).toBeInTheDocument();
  });

  it('does not display the vehicle name section when vehicleName prop is not provided', () => {
    render(<LogCard log={mockLog} onEdit={mockOnEdit} onDelete={mockOnDelete} />);
    // Query for the text pattern. It should not be found.
    // We check for the label "Vehicle:" to ensure the whole section isn't rendered.
    expect(screen.queryByText(/vehicle:/i)).not.toBeInTheDocument();
  });

  it('still renders other log details correctly when vehicleName is not provided', () => {
    render(<LogCard log={mockLog} onEdit={mockOnEdit} onDelete={mockOnDelete} />);
    expect(screen.getByText('Shell')).toBeInTheDocument();
    expect(screen.getByText(/distance/i)).toBeInTheDocument();
    // Note: The component formats numbers, so check for the formatted string including unit
    expect(screen.getByText((content, _element) => content.includes('300.0') && content.includes('Km'))).toBeInTheDocument();
    expect(screen.queryByText(/vehicle:/i)).not.toBeInTheDocument();
  });

  // Add tests for onEdit and onDelete calls if not covered elsewhere,
  // though these are simple pass-throughs in LogCard itself.
  it('calls onEdit when edit button is clicked', () => {
    render(<LogCard log={mockLog} onEdit={mockOnEdit} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByTitle(/edit log/i));
    expect(mockOnEdit).toHaveBeenCalledWith(mockLog);
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<LogCard log={mockLog} onEdit={mockOnEdit} onDelete={mockOnDelete} />);
    fireEvent.click(screen.getByTitle(/delete log/i));
    expect(mockOnDelete).toHaveBeenCalledWith(mockLog.id);
  });

});
