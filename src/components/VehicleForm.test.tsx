// src/components/VehicleForm.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VehicleForm from './VehicleForm';
import { Vehicle } from '../utils/types';

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

// Removed unused emptyVehicleData

const mockVehicleToEdit: Vehicle = {
  id: '1',
  userId: 'user1',
  name: 'Old Name',
  make: 'Old Make',
  model: 'Old Model',
  year: 2000,
};

describe('VehicleForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.alert as it's used for validation messages
    window.alert = jest.fn();
  });

  it('renders correctly for adding a new vehicle', () => {
    render(<VehicleForm onSave={mockOnSave} onCancel={mockOnCancel} isSaving={false} />);
    expect(screen.getByLabelText(/vehicle name/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /save vehicle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders correctly pre-filled for editing a vehicle', () => {
    render(<VehicleForm vehicleToEdit={mockVehicleToEdit} onSave={mockOnSave} onCancel={mockOnCancel} isSaving={false} />);
    expect(screen.getByLabelText(/vehicle name/i)).toHaveValue(mockVehicleToEdit.name);
    expect(screen.getByLabelText(/make/i)).toHaveValue(mockVehicleToEdit.make);
    expect(screen.getByLabelText(/model/i)).toHaveValue(mockVehicleToEdit.model);
    expect(screen.getByLabelText(/year/i)).toHaveValue(mockVehicleToEdit.year);
  });

  it('updates input fields as user types', () => {
    render(<VehicleForm onSave={mockOnSave} onCancel={mockOnCancel} isSaving={false} />);
    fireEvent.change(screen.getByLabelText(/vehicle name/i), { target: { value: 'New Car' } });
    expect(screen.getByLabelText(/vehicle name/i)).toHaveValue('New Car');
    fireEvent.change(screen.getByLabelText(/make/i), { target: { value: 'Honda' } });
    expect(screen.getByLabelText(/make/i)).toHaveValue('Honda');
  });

  it('calls onSave with correct data on valid submission for new vehicle', async () => {
    render(<VehicleForm onSave={mockOnSave} onCancel={mockOnCancel} isSaving={false} />);
    fireEvent.change(screen.getByLabelText(/vehicle name/i), { target: { value: 'My Ride' } });
    fireEvent.change(screen.getByLabelText(/make/i), { target: { value: 'Ford' } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'Focus' } });
    fireEvent.change(screen.getByLabelText(/year/i), { target: { value: '2021' } });

    fireEvent.submit(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'My Ride',
        make: 'Ford',
        model: 'Focus',
        year: 2021,
      });
    });
  });

  it('calls onSave with correct data on valid submission for editing vehicle', async () => {
    render(<VehicleForm vehicleToEdit={mockVehicleToEdit} onSave={mockOnSave} onCancel={mockOnCancel} isSaving={false} />);
    fireEvent.change(screen.getByLabelText(/vehicle name/i), { target: { value: 'Updated Ride' } });
    // Assume other fields remain the same or are also changed

    fireEvent.submit(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Updated Ride',
        make: mockVehicleToEdit.make, // Or new value if changed
        model: mockVehicleToEdit.model, // Or new value if changed
        year: mockVehicleToEdit.year, // Or new value if changed
      });
    });
  });

  it('shows alert and does not call onSave if name is empty', async () => {
    render(<VehicleForm onSave={mockOnSave} onCancel={mockOnCancel} isSaving={false} />);
    fireEvent.submit(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Vehicle name is required.');
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  it('shows alert and does not call onSave if year is invalid (e.g., too old)', async () => {
    render(<VehicleForm onSave={mockOnSave} onCancel={mockOnCancel} isSaving={false} />);
    fireEvent.change(screen.getByLabelText(/vehicle name/i), { target: { value: 'Old Timer' } });
    fireEvent.change(screen.getByLabelText(/year/i), { target: { value: '1800' } });
    fireEvent.submit(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Please enter a valid year (e.g., between 1900 and ' + (new Date().getFullYear() + 1) + ').');
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  it('shows alert and does not call onSave if year is invalid (e.g., future)', async () => {
    render(<VehicleForm onSave={mockOnSave} onCancel={mockOnCancel} isSaving={false} />);
    fireEvent.change(screen.getByLabelText(/vehicle name/i), { target: { value: 'Future Car' } });
    fireEvent.change(screen.getByLabelText(/year/i), { target: { value: String(new Date().getFullYear() + 2) } });
    fireEvent.submit(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Please enter a valid year (e.g., between 1900 and ' + (new Date().getFullYear() + 1) + ').');
        expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<VehicleForm onSave={mockOnSave} onCancel={mockOnCancel} isSaving={false} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when isSaving is true', () => {
    render(<VehicleForm onSave={mockOnSave} onCancel={mockOnCancel} isSaving={true} />);
    expect(screen.getByRole('button', { name: /saving.../i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

   it('handles empty optional fields correctly on submission', async () => {
    render(<VehicleForm onSave={mockOnSave} onCancel={mockOnCancel} isSaving={false} />);
    fireEvent.change(screen.getByLabelText(/vehicle name/i), { target: { value: 'Basic Car' } });
    // Leave make, model, year empty

    fireEvent.submit(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Basic Car',
        make: undefined, // Empty string becomes undefined
        model: undefined, // Empty string becomes undefined
        year: undefined,  // Empty string for year becomes undefined
      });
    });
  });

});
