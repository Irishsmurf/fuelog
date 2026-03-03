import { JSX, useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Vehicle, VehicleFuelType } from '../utils/types';

function ProfilePage(): JSX.Element {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '', make: '', model: '', year: new Date().getFullYear().toString(), fuelType: 'Petrol' as VehicleFuelType, isDefault: false
  });

  const fetchVehicles = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, "vehicles"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const vehicleList: Vehicle[] = [];
      querySnapshot.forEach((doc) => {
        vehicleList.push({ id: doc.id, ...doc.data() } as Vehicle);
      });
      setVehicles(vehicleList.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchVehicles(); }, [user]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleAddVehicle = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdating(true);
    setMessage(null);

    try {
      // If setting as default, unset others first
      if (formData.isDefault && vehicles.length > 0) {
        const batch = writeBatch(db);
        vehicles.forEach(v => {
          if (v.isDefault) batch.update(doc(db, "vehicles", v.id), { isDefault: false });
        });
        await batch.commit();
      }

      await addDoc(collection(db, "vehicles"), {
        ...formData,
        userId: user.uid,
        isDefault: vehicles.length === 0 ? true : formData.isDefault // First vehicle is always default
      });

      setMessage({ type: 'success', text: 'Vehicle added successfully!' });
      setFormData({ name: '', make: '', model: '', year: new Date().getFullYear().toString(), fuelType: 'Petrol', isDefault: false });
      fetchVehicles();
    } catch (error: any) {
      console.error("Error adding vehicle:", error);
      const errorMsg = error.code === 'permission-denied' 
        ? 'Permission denied. Please check Firestore security rules.' 
        : 'Failed to add vehicle. Please try again.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!window.confirm("Are you sure? This won't delete logs but will un-link them.")) return;
    try {
      await deleteDoc(doc(db, "vehicles", id));
      fetchVehicles();
    } catch (error: any) { 
      console.error("Error deleting vehicle:", error); 
      const errorMsg = error.code === 'permission-denied' 
        ? 'Permission denied to delete.' 
        : 'Failed to delete vehicle.';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  const handleSetDefault = async (vehicle: Vehicle) => {
    try {
      const batch = writeBatch(db);
      vehicles.forEach(v => {
        batch.update(doc(db, "vehicles", v.id), { isDefault: v.id === vehicle.id });
      });
      await batch.commit();
      fetchVehicles();
    } catch (error: any) { 
      console.error("Error setting default vehicle:", error); 
      const errorMsg = error.code === 'permission-denied' 
        ? 'Permission denied to update defaults.' 
        : 'Failed to set default vehicle.';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 space-y-8">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Manage Your Vehicles</h2>
        
        {/* Vehicle List */}
        <div className="space-y-4 mb-8">
          {isLoading ? (
            <p className="text-center animate-pulse">Loading vehicles...</p>
          ) : vehicles.length === 0 ? (
            <p className="text-gray-500 text-center italic">No vehicles added yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.map(v => (
                <div key={v.id} className={`p-4 rounded-lg border flex justify-between items-center ${v.isDefault ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div>
                    <h4 className="font-bold text-lg">{v.name} {v.isDefault && <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Default</span>}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{v.year} {v.make} {v.model} ({v.fuelType})</p>
                  </div>
                  <div className="flex space-x-2">
                    {!v.isDefault && (
                      <button onClick={() => handleSetDefault(v)} className="text-xs text-indigo-600 hover:underline">Set Default</button>
                    )}
                    <button onClick={() => handleDeleteVehicle(v.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="my-8 border-gray-200 dark:border-gray-700" />

        {/* Add Vehicle Form */}
        <h3 className="text-xl font-bold mb-4">Add New Vehicle</h3>
        <form onSubmit={handleAddVehicle} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Nickname / Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g. My Polo" className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Make</label>
            <input type="text" name="make" value={formData.make} onChange={handleInputChange} required placeholder="e.g. VW" className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Model</label>
            <input type="text" name="model" value={formData.model} onChange={handleInputChange} required placeholder="e.g. Polo" className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Year</label>
            <input type="number" name="year" value={formData.year} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fuel Type</label>
            <select name="fuelType" value={formData.fuelType} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Electric">Electric</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex items-center">
            <input type="checkbox" name="isDefault" id="isDefault" checked={formData.isDefault} onChange={handleInputChange} className="h-4 w-4 text-indigo-600 rounded" />
            <label htmlFor="isDefault" className="ml-2 text-sm">Set as default vehicle</label>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition duration-150 disabled:opacity-50">
              {isSaving ? 'Adding...' : 'Add Vehicle'}
            </button>
          </div>
        </form>
        {message && (
          <div className={`mt-4 p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
