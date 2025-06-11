// src/pages/VehiclesPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from 'react-router-dom'; // Needed if Link is used
import VehiclesPage from './VehiclesPage';
import * as AuthContext from '../context/AuthContext';
import * as FirestoreService from '../firebase/firestoreService';
import { Vehicle } from '../utils/types';

// Mock child components
jest.mock('../components/VehicleCard', () => (props: any) => (
  <div data-testid="vehicle-card">
    <span>{props.vehicle.name}</span> {/* Display name for easier querying */}
    <button onClick={() => props.onEdit(props.vehicle)}>Edit-{props.vehicle.name}</button>
    <button onClick={() => props.onDelete(props.vehicle.id)}>Delete-{props.vehicle.name}</button>
  </div>
));

jest.mock('../components/VehicleForm', () => (props: any) => (
  <div data-testid="vehicle-form">
    <form onSubmit={(e) => {
      e.preventDefault();
      // Simulate a more realistic save based on whether it's an edit or add
      const vehicleDataToSave = props.vehicleToEdit
        ? { ...props.vehicleToEdit, name: 'Updated Vehicle Name', make: props.vehicleToEdit.make || 'TestMakeUpdate' }
        : { name: 'New Saved Vehicle', make: 'TestMakeNew' };
      props.onSave(vehicleDataToSave);
    }}>
      {props.vehicleToEdit && <p>Editing: {props.vehicleToEdit.name}</p>}
      <label htmlFor="vehicleNameInput">Vehicle Name</label>
      <input id="vehicleNameInput" defaultValue={props.vehicleToEdit?.name || 'New Vehicle Name'} />
      <button type="submit">Save Form</button>
      <button type="button" onClick={props.onCancel}>Cancel Form</button>
    </form>
  </div>
));

// Mock firestoreService
jest.mock('../firebase/firestoreService', () => ({
  fetchUserVehicles: jest.fn(),
  addVehicle: jest.fn(),
  updateVehicle: jest.fn(),
  deleteVehicle: jest.fn(),
}));

// Mock useAuth
const mockUseAuth = AuthContext.useAuth as jest.Mock;
jest.mock('../context/AuthContext');


const mockVehicles: Vehicle[] = [
  { id: '1', userId: 'user1', name: 'My Sedan', make: 'Toyota', model: 'Camry', year: 2021 },
  { id: '2', userId: 'user1', name: 'Work Truck', make: 'Ford', model: 'F-150', year: 2020 },
];

describe('VehiclesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to logged-in user for most tests
    mockUseAuth.mockReturnValue({ user: { uid: 'user1', displayName: 'Test User' } });
    (FirestoreService.fetchUserVehicles as jest.Mock).mockResolvedValue([...mockVehicles]); // Default successful fetch
  });

  it('renders loading state initially then vehicles', async () => {
    // Temporarily make fetchUserVehicles slow to catch loading state
    let resolveVehicles: (value: Vehicle[] | PromiseLike<Vehicle[]>) => void;
    (FirestoreService.fetchUserVehicles as jest.Mock).mockImplementationOnce(() =>
        new Promise((resolve) => { resolveVehicles = resolve; })
    );
    render(<Router><VehiclesPage /></Router>);
    expect(screen.getByText(/loading vehicles.../i)).toBeInTheDocument();

    // Resolve the promise
    await waitFor(() => resolveVehicles([...mockVehicles]));

    await waitFor(() => {
      expect(screen.getAllByTestId('vehicle-card')).toHaveLength(mockVehicles.length);
    });
  });

  it('renders error state if fetching vehicles fails', async () => {
    (FirestoreService.fetchUserVehicles as jest.Mock).mockRejectedValue(new Error('Failed to fetch'));
    render(<Router><VehiclesPage /></Router>);
    await waitFor(() => {
      expect(screen.getByText(/failed to load vehicles. please try again./i)).toBeInTheDocument();
    });
  });

  it('renders "no vehicles" message if list is empty', async () => {
    (FirestoreService.fetchUserVehicles as jest.Mock).mockResolvedValue([]);
    render(<Router><VehiclesPage /></Router>);
    await waitFor(() => {
      expect(screen.getByText(/no vehicles added yet./i)).toBeInTheDocument();
      expect(screen.getByText(/add your first vehicle/i)).toBeInTheDocument(); // Button in empty state
    });
  });

  it('renders vehicle cards when vehicles are fetched', async () => {
    // fetchUserVehicles is already mocked in beforeEach to return mockVehicles
    render(<Router><VehiclesPage /></Router>);
    await waitFor(() => {
      expect(screen.getAllByTestId('vehicle-card')).toHaveLength(mockVehicles.length);
      expect(screen.getByText('My Sedan')).toBeInTheDocument(); // Check for actual name via mock card
      expect(screen.getByText('Work Truck')).toBeInTheDocument();
    });
  });

  it('shows "Please log in" message if no user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null });
    (FirestoreService.fetchUserVehicles as jest.Mock).mockResolvedValue([]); // Ensure it doesn't try to load
    render(<Router><VehiclesPage /></Router>);
    expect(screen.getByText(/please log in to manage your vehicles./i)).toBeInTheDocument();
  });

  describe('VehicleForm interactions', () => {
    beforeEach(async () => {
      // Vehicles already loaded by default beforeEach in parent describe
      render(<Router><VehiclesPage /></Router>);
      await waitFor(() => expect(screen.getByText('My Vehicles')).toBeInTheDocument());
    });

    it('opens VehicleForm in "add" mode when "Add Vehicle" button is clicked', () => {
      fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
      expect(screen.getByTestId('vehicle-form')).toBeInTheDocument();
      expect(screen.queryByText(/editing:/i)).not.toBeInTheDocument();
    });

    it('opens VehicleForm in "edit" mode when an edit button on VehicleCard is clicked', () => {
      fireEvent.click(screen.getByText('Edit-My Sedan'));
      expect(screen.getByTestId('vehicle-form')).toBeInTheDocument();
      expect(screen.getByText('Editing: My Sedan')).toBeInTheDocument();
    });

    it('calls addVehicle when saving a new vehicle', async () => {
      (FirestoreService.addVehicle as jest.Mock).mockResolvedValue('newVehicleId');
      (FirestoreService.fetchUserVehicles as jest.Mock).mockResolvedValueOnce([...mockVehicles]) // Initial load
                                                        .mockResolvedValueOnce([...mockVehicles, {id: 'newVehicleId', userId: 'user1', name: 'New Saved Vehicle', make: 'TestMakeNew'}]); // After adding

      fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Form' }));

      await waitFor(() => {
        expect(FirestoreService.addVehicle).toHaveBeenCalledWith({ name: 'New Saved Vehicle', make: 'TestMakeNew' });
        expect(FirestoreService.fetchUserVehicles).toHaveBeenCalledTimes(2);
      });
      expect(screen.queryByTestId('vehicle-form')).not.toBeInTheDocument();
    });

    it('calls updateVehicle when saving an existing vehicle', async () => {
      (FirestoreService.updateVehicle as jest.Mock).mockResolvedValue(true);
       const updatedVehicle = { ...mockVehicles[0], name: 'Updated Vehicle Name', make: 'TestMakeUpdate' };
      (FirestoreService.fetchUserVehicles as jest.Mock).mockResolvedValueOnce([...mockVehicles]) // Initial
                                                        .mockResolvedValueOnce([updatedVehicle, mockVehicles[1]]); // After update


      fireEvent.click(screen.getByText('Edit-My Sedan'));
      fireEvent.click(screen.getByRole('button', { name: 'Save Form' }));

      await waitFor(() => {
        expect(FirestoreService.updateVehicle).toHaveBeenCalledWith(mockVehicles[0].id, { name: 'Updated Vehicle Name', make: 'TestMakeUpdate' });
        expect(FirestoreService.fetchUserVehicles).toHaveBeenCalledTimes(2);
      });
      expect(screen.queryByTestId('vehicle-form')).not.toBeInTheDocument();
    });

    it('closes the form when cancel button is clicked', () => {
      fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
      expect(screen.getByTestId('vehicle-form')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel Form' }));
      expect(screen.queryByTestId('vehicle-form')).not.toBeInTheDocument();
    });

     it('displays an error if saving a vehicle fails', async () => {
        (FirestoreService.addVehicle as jest.Mock).mockResolvedValue(null);
        fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Save Form' }));

        await waitFor(() => {
            expect(screen.getByText(/failed to save vehicle. please try again./i)).toBeInTheDocument();
        });
        expect(screen.getByTestId('vehicle-form')).toBeInTheDocument();
    });
  });

  describe('Vehicle deletion', () => {
    beforeEach(async () => {
      // Vehicles are loaded by default in parent describe
      window.confirm = jest.fn(() => true); // Mock window.confirm
      render(<Router><VehiclesPage /></Router>);
      await waitFor(() => expect(screen.getByText('My Vehicles')).toBeInTheDocument());
    });

    it('calls deleteVehicle and optimistically updates UI when confirmed', async () => {
      (FirestoreService.deleteVehicle as jest.Mock).mockResolvedValue(true);

      // Initial state check
      expect(screen.getByText('My Sedan')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Delete-My Sedan'));

      await waitFor(() => {
        expect(FirestoreService.deleteVehicle).toHaveBeenCalledWith(mockVehicles[0].id);
      });
      // Check if the item is optimistically removed
      expect(screen.queryByText('My Sedan')).not.toBeInTheDocument();
      // Verify that the other vehicle is still there
      expect(screen.getByText('Work Truck')).toBeInTheDocument();
    });

    it('does not call deleteVehicle if confirmation is cancelled', () => {
      window.confirm = jest.fn(() => false);
      fireEvent.click(screen.getByText('Delete-My Sedan'));
      expect(FirestoreService.deleteVehicle).not.toHaveBeenCalled();
      expect(screen.getByText('My Sedan')).toBeInTheDocument(); // Still there
    });

    it('displays an error if deleting a vehicle fails', async () => {
        (FirestoreService.deleteVehicle as jest.Mock).mockResolvedValue(false);
        fireEvent.click(screen.getByText('Delete-My Sedan'));

        await waitFor(() => {
            expect(screen.getByText(/failed to delete vehicle. please try again./i)).toBeInTheDocument();
        });
        expect(screen.getByText('My Sedan')).toBeInTheDocument(); // Still there because delete failed
    });
  });
});
