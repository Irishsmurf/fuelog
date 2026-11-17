// The "add new vehicle" form. The parent saves; the form resets on success.
import { ChangeEvent, FormEvent, JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, PlusCircle, RefreshCw } from 'lucide-react';
import type { NewVehicleInput } from '../../data/vehicles';
import StatusBanner, { type StatusMessage } from './StatusBanner';

const emptyForm = (): NewVehicleInput => ({
  name: '', make: '', model: '', year: new Date().getFullYear().toString(), fuelType: 'Petrol', isDefault: false,
});

interface Props {
  /** Saves the vehicle; resolves true on success (the form then clears). */
  onAdd: (input: NewVehicleInput) => Promise<boolean>;
  isSaving: boolean;
  message: StatusMessage | null;
}

export default function AddVehicleForm({ onAdd, isSaving, message }: Props): JSX.Element {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<NewVehicleInput>(emptyForm);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (await onAdd(formData)) setFormData(emptyForm());
  };

  return (
    <div className="nocturne-card rounded-2xl p-6 sm:p-8">
      <div className="flex items-center space-x-3 mb-8">
        <div className="bg-brand-primary/10 p-2 rounded-lg text-brand-primary">
          <PlusCircle size={20} />
        </div>
        <h3 className="text-xl font-medium tracking-tight">{t('profile.addNewVehicle')}</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2">
            <label className="block nocturne-label uppercase tracking-wider">{t('profile.vehicleForm.nickname')}</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder={t('profile.vehicleForm.nicknamePlaceholder')} className="nocturne-input" />
          </div>
          <div>
            <label className="block nocturne-label uppercase tracking-wider">{t('profile.vehicleForm.make')}</label>
            <input type="text" name="make" value={formData.make} onChange={handleInputChange} required placeholder={t('profile.vehicleForm.makePlaceholder')} className="nocturne-input" />
          </div>
          <div>
            <label className="block nocturne-label uppercase tracking-wider">{t('profile.vehicleForm.model')}</label>
            <input type="text" name="model" value={formData.model} onChange={handleInputChange} required placeholder={t('profile.vehicleForm.modelPlaceholder')} className="nocturne-input" />
          </div>
          <div>
            <label className="block nocturne-label uppercase tracking-wider">{t('profile.vehicleForm.year')}</label>
            <input type="number" name="year" value={formData.year} onChange={handleInputChange} required className="nocturne-input" />
          </div>
          <div>
            <label className="block nocturne-label uppercase tracking-wider">{t('profile.vehicleForm.fuelType')}</label>
            <select name="fuelType" value={formData.fuelType} onChange={handleInputChange} className="nocturne-input">
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

      {message && <StatusBanner message={message} />}
    </div>
  );
}
