import { JSX, useState, useEffect, ChangeEvent, FormEvent, useCallback } from 'react';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, writeBatch, updateDoc } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Vehicle, VehicleFuelType } from '../utils/types';
import { Car, Archive, Trash2, CheckCircle2, AlertCircle, PlusCircle, RefreshCw, Settings, Coins, Bell, BellOff } from 'lucide-react';
import ApiTokenManager from '../components/ApiTokenManager';
import { useFCMToken } from '../hooks/useFCMToken';
import { COMMON_CURRENCIES } from '../utils/currencyApi';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

function ProfilePage(): JSX.Element {
  const { user, profile, updateProfile } = useAuth();
  const { t } = useTranslation();
  const { isEnabled: notificationsEnabled, isLoading: notificationsLoading, enable: enableNotifications, disable: disableNotifications } = useFCMToken();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '', make: '', model: '', year: new Date().getFullYear().toString(), fuelType: 'Petrol' as VehicleFuelType, isDefault: false
  });

  const fetchVehicles = useCallback(async () => {
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
  }, [user]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

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
        isArchived: false,
        isDefault: vehicles.filter(v => !v.isArchived).length === 0 ? true : formData.isDefault
      });

      setMessage({ type: 'success', text: t('profile.messages.vehicleAdded') });
      setFormData({ name: '', make: '', model: '', year: new Date().getFullYear().toString(), fuelType: 'Petrol', isDefault: false });
      fetchVehicles();
    } catch (err: unknown) {
      console.error("Error adding vehicle:", err);
      const error = err as { code?: string };
      const errorMsg = error.code === 'permission-denied'
        ? t('profile.messages.permissionDenied')
        : t('profile.messages.failedToAdd');
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!window.confirm(t('profile.messages.deleteConfirm'))) return;
    try {
      await deleteDoc(doc(db, "vehicles", id));
      fetchVehicles();
    } catch (err: unknown) {
      console.error("Error deleting vehicle:", err);
      const error = err as { code?: string };
      const errorMsg = error.code === 'permission-denied'
        ? t('profile.messages.permissionDeniedDelete')
        : t('profile.messages.failedToDelete');
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  const handleArchiveVehicle = async (vehicle: Vehicle) => {
    try {
      const isNowArchived = !vehicle.isArchived;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = { isArchived: isNowArchived };

      if (isNowArchived && vehicle.isDefault) {
        updates.isDefault = false;
      }

      await updateDoc(doc(db, "vehicles", vehicle.id), updates);
      fetchVehicles();
    } catch (err: unknown) {
      console.error("Error archiving vehicle:", err);
    }
  };

  const handleSetDefault = async (vehicle: Vehicle) => {
    if (vehicle.isArchived) return;
    try {
      const batch = writeBatch(db);
      vehicles.forEach(v => {
        batch.update(doc(db, "vehicles", v.id), { isDefault: v.id === vehicle.id });
      });
      await batch.commit();
      fetchVehicles();
    } catch (err: unknown) {
      console.error("Error setting default vehicle:", err);
      const error = err as { code?: string };
      const errorMsg = error.code === 'permission-denied'
        ? t('profile.messages.permissionDeniedDefault')
        : t('profile.messages.failedToSetDefault');
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  const activeVehicles = vehicles.filter(v => !v.isArchived);
  const archivedVehicles = vehicles.filter(v => v.isArchived);

  const renderVehicleCard = (v: Vehicle) => (
    <div key={v.id} className={`group relative bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md ${v.isDefault ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-gray-100 dark:border-gray-700'}`}>
      <div className="p-5 flex items-start space-x-4">
        {/* Car Icon Accent */}
        <div className={`p-3 rounded-xl transition-colors ${v.isDefault ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-50 dark:bg-gray-900 text-gray-400'}`}>
          <Car size={24} />
        </div>

        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-start">
            <h4 className="text-lg font-black tracking-tight truncate text-gray-900 dark:text-white">{v.name}</h4>
            {v.isDefault && (
              <span className="shrink-0 flex items-center text-[10px] font-black uppercase tracking-widest text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">
                {t('profile.vehicleCard.primary')}
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">{v.make} • {v.model}</p>

          <div className="flex items-center space-x-3 mt-3">
            <div className="flex items-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-indigo-400 mr-1.5"></span>
              {v.year}
            </div>
            <div className="flex items-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
              <span className={`w-2 h-2 rounded-full mr-1.5 ${v.fuelType === 'Electric' ? 'bg-green-400' : 'bg-amber-400'}`}></span>
              {v.fuelType}
            </div>
          </div>
        </div>
      </div>

      {/* Action Overlay/Bar */}
      <div className="flex border-t border-gray-50 dark:border-gray-700 divide-x divide-gray-50 dark:divide-gray-700">
        {!v.isArchived && !v.isDefault && (
          <button
            onClick={() => handleSetDefault(v)}
            className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-brand-primary hover:bg-brand-primary/5 transition-all flex items-center justify-center space-x-1.5"
          >
            <CheckCircle2 size={12} />
            <span>{t('profile.vehicleCard.makeDefault')}</span>
          </button>
        )}
        <button
          onClick={() => handleArchiveVehicle(v)}
          className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all flex items-center justify-center space-x-1.5"
          title={v.isArchived ? t('profile.vehicleCard.restore') : t('profile.vehicleCard.archive')}
        >
          <Archive size={12} />
          <span>{v.isArchived ? t('profile.vehicleCard.restore') : t('profile.vehicleCard.archive')}</span>
        </button>
        <button
          onClick={() => handleDeleteVehicle(v.id)}
          className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center space-x-1.5"
        >
          <Trash2 size={12} />
          <span>{t('profile.vehicleCard.delete')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 space-y-10 pb-12 text-gray-900 dark:text-gray-100">
      {/* App Preferences Section */}
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-3xl p-6 sm:p-10 border border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center space-x-3 mb-8">
          <div className="bg-brand-primary/10 p-2 rounded-lg text-brand-primary">
            <Settings size={20} />
          </div>
          <h3 className="text-xl font-black tracking-tight">{t('profile.appPreferences')}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-brand-primary">
              <Coins size={18} />
              <h4 className="text-sm font-black uppercase tracking-widest">{t('profile.homeCurrency')}</h4>
            </div>
            <p className="text-xs text-gray-500 font-medium leading-relaxed">
              {t('profile.homeCurrencyDesc')}
            </p>
            <select
              value={profile?.homeCurrency || 'EUR'}
              onChange={(e) => updateProfile({ homeCurrency: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-gray-900 dark:text-white"
            >
              {COMMON_CURRENCIES.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.code} ({curr.symbol}) - {curr.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-brand-primary">
              <Settings size={18} />
              <h4 className="text-sm font-black uppercase tracking-widest">{t('language.label')}</h4>
            </div>
            <p className="text-xs text-gray-500 font-medium leading-relaxed">
              {t('language.en')} / {t('language.ga')}
            </p>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <LanguageSelector />
            </div>
          </div>
        </div>

        <div className="mt-8 opacity-40 grayscale pointer-events-none">
          <div className="flex items-center space-x-2 text-gray-400">
            <Settings size={18} />
            <h4 className="text-sm font-black uppercase tracking-widest">{t('profile.measurementUnits')}</h4>
          </div>
          <p className="text-xs text-gray-400 font-medium mt-4 italic">{t('profile.measurementUnitsSoon')}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white">{t('profile.vehicleFleet')}</h2>
            <p className="text-sm font-medium text-gray-500">{t('profile.vehicleFleetSubtext')}</p>
          </div>
          {archivedVehicles.length > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs font-black uppercase tracking-widest text-brand-primary hover:underline"
            >
              {showArchived ? t('profile.hideArchived') : t('profile.showArchived', { count: archivedVehicles.length })}
            </button>
          )}
        </div>

        {/* Active Vehicle Grid */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map(i => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl"></div>)}
            </div>
          ) : activeVehicles.length === 0 ? (
            <div className="bg-white dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl p-12 text-center">
              <div className="bg-gray-50 dark:bg-gray-900 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
                <Car size={32} />
              </div>
              <p className="text-gray-500 font-bold">{t('profile.noActiveVehicles')}</p>
              <p className="text-gray-400 text-xs mt-1">{t('profile.noActiveVehiclesSubtext')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeVehicles.map(renderVehicleCard)}
            </div>
          )}
        </div>

        {/* Archived Vehicle Grid */}
        {showArchived && archivedVehicles.length > 0 && (
          <div className="mt-10 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-4 flex items-center">
              <Archive size={14} className="mr-2" /> {t('profile.archivedFleet')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
              {archivedVehicles.map(renderVehicleCard)}
            </div>
          </div>
        )}
      </div>

      {/* Add Vehicle Section */}
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-3xl p-6 sm:p-10 border border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center space-x-3 mb-8">
          <div className="bg-brand-primary/10 p-2 rounded-lg text-brand-primary">
            <PlusCircle size={20} />
          </div>
          <h3 className="text-xl font-black tracking-tight">{t('profile.addNewVehicle')}</h3>
        </div>

        <form onSubmit={handleAddVehicle} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">{t('profile.vehicleForm.nickname')}</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder={t('profile.vehicleForm.nicknamePlaceholder')} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">{t('profile.vehicleForm.make')}</label>
              <input type="text" name="make" value={formData.make} onChange={handleInputChange} required placeholder={t('profile.vehicleForm.makePlaceholder')} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">{t('profile.vehicleForm.model')}</label>
              <input type="text" name="model" value={formData.model} onChange={handleInputChange} required placeholder={t('profile.vehicleForm.modelPlaceholder')} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">{t('profile.vehicleForm.year')}</label>
              <input type="number" name="year" value={formData.year} onChange={handleInputChange} required className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">{t('profile.vehicleForm.fuelType')}</label>
              <select name="fuelType" value={formData.fuelType} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-gray-900 dark:text-white">
                <option value="Petrol">{t('profile.vehicleForm.fuelTypes.petrol')}</option>
                <option value="Diesel">{t('profile.vehicleForm.fuelTypes.diesel')}</option>
                <option value="Hybrid">{t('profile.vehicleForm.fuelTypes.hybrid')}</option>
                <option value="Electric">{t('profile.vehicleForm.fuelTypes.electric')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
            <input type="checkbox" name="isDefault" id="isDefault" checked={formData.isDefault} onChange={handleInputChange} className="h-5 w-5 text-brand-primary rounded-lg border-none focus:ring-0 focus:ring-offset-0 transition-all" />
            <label htmlFor="isDefault" className="ml-3 text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center">
              <CheckCircle2 size={16} className="mr-2 text-brand-primary" />
              {t('profile.vehicleForm.setAsDefault')}
            </label>
          </div>

          <button type="submit" disabled={isSaving} className="brand-button-primary w-full py-4 text-base shadow-xl">
            {isSaving ? (
              <div className="flex items-center space-x-2">
                <RefreshCw size={20} className="animate-spin" />
                <span>{t('profile.vehicleForm.registering')}</span>
              </div>
            ) : t('profile.vehicleForm.register')}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-2xl border flex items-center space-x-3 animate-in slide-in-from-bottom-2 ${message.type === 'success' ? 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' : 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'}`}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <p className="text-sm font-bold">{message.text}</p>
          </div>
        )}
      </div>

      {/* Notifications Section */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-yellow-500" />
          </div>
          <h3 className="text-xl font-black tracking-tight">{t('profile.notifications.heading', { defaultValue: 'Notifications' })}</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{t('profile.notifications.weeklyDigest', { defaultValue: 'Weekly fuel digest' })}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('profile.notifications.weeklyDigestDesc', { defaultValue: 'Push notification every Monday with your weekly fuel summary.' })}</p>
          </div>
          <button
            onClick={notificationsEnabled ? disableNotifications : enableNotifications}
            disabled={notificationsLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              notificationsEnabled
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {notificationsEnabled ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            {notificationsEnabled
              ? t('profile.notifications.disable', { defaultValue: 'Disable' })
              : t('profile.notifications.enable', { defaultValue: 'Enable' })}
          </button>
        </div>
      </div>

      {/* API Access Section */}
      <ApiTokenManager />
    </div>
  );
}

export default ProfilePage;
