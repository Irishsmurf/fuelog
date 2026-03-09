import React, { useRef, useState } from 'react';
import { Camera, X, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ImageUploadProps {
  onFileSelect: (file: File | null) => void;
  label?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onFileSelect, label }) => {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('imageUpload.receiptPhoto');
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {resolvedLabel}
      </label>
      
      {!preview ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2" />
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            {t('imageUpload.snapOrSelect')}
          </span>
        </button>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group">
          <img 
            src={preview} 
            alt="Receipt preview" 
            className="w-full h-32 object-cover" 
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
          >
            <X size={16} />
          </button>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <ImageIcon className="text-white w-6 h-6" />
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
    </div>
  );
};

export default ImageUpload;
