// src/pages/ImportPage.tsx
import { JSX, useState, useEffect, ChangeEvent } from 'react';
import { collection, writeBatch, Timestamp, doc, query, where, getDocs } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Vehicle } from '../utils/types';
import { Link } from 'react-router-dom';

type ImportStatus = 'idle' | 'reading' | 'parsing' | 'importing' | 'success' | 'error';
interface ImportMessage {
  type: 'info' | 'success' | 'error';
  text: string;
}

function ImportPage(): JSX.Element {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [message, setMessage] = useState<ImportMessage | null>(null);
  const [importedCount, setImportedCount] = useState<number>(0);

  // --- Multi-Vehicle State ---
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [isLoadingVehicles, setIsLoadingVehicles] = useState<boolean>(true);

  // --- Fetch Vehicles ---
  useEffect(() => {
    if (!user) return;
    const fetchVehicles = async () => {
      setIsLoadingVehicles(true);
      try {
        const q = query(collection(db, "vehicles"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        const list: Vehicle[] = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (!data.isArchived) {
                list.push({ ...data, id: doc.id } as Vehicle);
            }
        });
        const sorted = list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setVehicles(sorted);
        const defaultVehicle = sorted.find(v => v.isDefault) || sorted[0];
        if (defaultVehicle) setSelectedVehicleId(defaultVehicle.id);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
      } finally {
        setIsLoadingVehicles(false);
      }
    };
    fetchVehicles();
  }, [user]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setStatus('idle'); setMessage(null); setImportedCount(0);
    } else { setSelectedFile(null); }
  };

  const parseDate = (dateString: string): Timestamp | null => {
    try {
      const parts = dateString.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/); // DD/MM/YYYY
      if (parts && parts.length === 4) {
        const day = parseInt(parts[1], 10); const month = parseInt(parts[2], 10) - 1; const year = parseInt(parts[3], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const date = new Date(year, month, day);
          if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) { return Timestamp.fromDate(date); }
        }
      }
      console.warn(`Could not parse date: "${dateString}"`); return null;
    } catch (e) { console.error(`Error parsing date "${dateString}":`, e); return null; }
  };

  const handleImport = async () => {
    if (!selectedFile || !user) { setMessage({ type: 'error', text: 'Please select a TSV file and ensure you are logged in.' }); return; }
    if (!selectedVehicleId) { setMessage({ type: 'error', text: 'Please select a vehicle for this import.' }); return; }
    
    setStatus('reading'); setMessage({ type: 'info', text: 'Reading file...' }); setImportedCount(0);
    const reader = new FileReader();

    reader.onload = async (event) => {
      if (!event.target || typeof event.target.result !== 'string') { setStatus('error'); setMessage({ type: 'error', text: 'Failed to read file content.' }); return; }
      try {
        setStatus('parsing'); setMessage({ type: 'info', text: 'Parsing data...' });
        const fileContent = event.target.result; const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) { throw new Error('File must contain at least a header row and one data row.'); }

        const headers = lines[0].split('\t').map(h => h.trim());
        const requiredHeaders = ['Date', 'Litres', 'Total Cost', 'Garage', 'Distance since fueled'];
        const headerMap: { [key: string]: number } = {};
        requiredHeaders.forEach(reqHeader => {
          const index = headers.findIndex(h => h.toLowerCase() === reqHeader.toLowerCase());
          if (index === -1) { throw new Error(`Missing required header column: "${reqHeader}"`); }
          headerMap[reqHeader] = index;
        });

        const logsToImport = []; const errors: string[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          if (values.length < requiredHeaders.length) { errors.push(`Row ${i + 1}: Insufficient columns.`); continue; }

          const dateStr = values[headerMap['Date']]; const litresStr = values[headerMap['Litres']];
          const costStr = values[headerMap['Total Cost']]; const garageStr = values[headerMap['Garage']];
          const distanceKmStr = values[headerMap['Distance since fueled']]; // Confirmed Km

          const timestamp = parseDate(dateStr); const fuelAmountLiters = parseFloat(litresStr);
          const cost = parseFloat(costStr); const distanceKm = parseFloat(distanceKmStr); // Parse Km

          if (!timestamp) { errors.push(`Row ${i + 1}: Invalid Date "${dateStr}".`); continue; }
          if (isNaN(fuelAmountLiters) || fuelAmountLiters <= 0) { errors.push(`Row ${i + 1}: Invalid Litres "${litresStr}".`); continue; }
          if (isNaN(cost) || cost <= 0) { errors.push(`Row ${i + 1}: Invalid Cost "${costStr}".`); continue; }
          if (isNaN(distanceKm) || distanceKm <= 0) { errors.push(`Row ${i + 1}: Invalid Distance "${distanceKmStr}".`); continue; }

          // NO conversion here, save distanceKm directly
          logsToImport.push({
            userId: user.uid,
            vehicleId: selectedVehicleId, // Link to vehicle
            timestamp: timestamp,
            brand: garageStr.trim() || 'Unknown',
            cost: cost,
            distanceKm: distanceKm,
            fuelAmountLiters: fuelAmountLiters,
          });
        }

        if (errors.length > 0) { setMessage({ type: 'error', text: `Found ${errors.length} errors during parsing. First few: ${errors.slice(0, 5).join('; ')}` }); setStatus('error'); return; }
        if (logsToImport.length === 0) { setMessage({ type: 'info', text: 'No valid logs found to import after parsing.' }); setStatus('idle'); return; }

        setStatus('importing'); setMessage({ type: 'info', text: `Importing ${logsToImport.length} valid logs...` });
        const batchSize = 499; let importedCountTotal = 0;
        for (let i = 0; i < logsToImport.length; i += batchSize) {
            const batch = writeBatch(db); const chunk = logsToImport.slice(i, i + batchSize);
            chunk.forEach((logData) => { const logRef = doc(collection(db, "fuelLogs")); batch.set(logRef, logData); });
            await batch.commit(); importedCountTotal += chunk.length;
            setMessage({ type: 'info', text: `Importing... (${importedCountTotal}/${logsToImport.length})` });
        }
        setImportedCount(importedCountTotal); setStatus('success'); setMessage({ type: 'success', text: `Successfully imported ${importedCountTotal} logs!` });
      } catch (error: any) { console.error("Import Error:", error); setStatus('error'); setMessage({ type: 'error', text: `Import failed: ${error.message}` }); }
    };
    reader.onerror = () => { setStatus('error'); setMessage({ type: 'error', text: 'Error reading the selected file.' }); };
    reader.readAsText(selectedFile);
  };

  const messageClasses = message?.type === 'error' 
    ? 'text-red-700 bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' 
    : message?.type === 'success' 
      ? 'text-green-700 bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' 
      : 'text-blue-700 bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';

  return (
    <div className="container mx-auto max-w-2xl px-4">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700 space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white">Import Fuel Logs</h2>
        
        {isLoadingVehicles ? (
          <div className="text-center py-4 animate-pulse text-gray-500">Loading vehicles...</div>
        ) : vehicles.length === 0 ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center space-y-3">
            <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">No active vehicles found.</p>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">You need an active vehicle to import logs.</p>
            <Link to="/profile" className="inline-block bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold py-2 px-4 rounded-md transition duration-150">
              Go to Profile
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
                <label htmlFor="vehicle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Vehicle
                </label>
                <select
                  id="vehicle"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:text-sm"
                  disabled={status === 'reading' || status === 'parsing' || status === 'importing'}
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.make} {v.model})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-gray-500 italic">All logs in the file will be assigned to this vehicle.</p>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed pt-2">
              Select a Tab-Separated Value (.tsv or .txt) file. Ensure headers include: 
              <code className="mx-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">Date</code>, 
              <code className="mx-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">Litres</code>, 
              <code className="mx-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">Total Cost</code>, 
              <code className="mx-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">Garage</code>, and 
              <code className="mx-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">Distance since fueled</code> (in Km).
            </p>
            
            <div className="space-y-2">
              <label htmlFor="tsvFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                TSV File
              </label>
              <input 
                type="file" 
                id="tsvFile" 
                accept=".tsv,.txt,text/tab-separated-values" 
                onChange={handleFileChange} 
                className="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2.5 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  dark:file:bg-indigo-900/50 dark:file:text-indigo-300
                  hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/70
                  border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                disabled={status === 'reading' || status === 'parsing' || status === 'importing'}
              />
            </div>

            <button 
              onClick={handleImport} 
              disabled={!selectedFile || !user || !selectedVehicleId || status === 'reading' || status === 'parsing' || status === 'importing'}
              className="w-full brand-button-primary py-3"
            >
              {status === 'importing' ? `Importing... (${importedCount})` : 
               status === 'parsing' ? 'Parsing...' : 
               status === 'reading' ? 'Reading...' : 'Process & Import Data'}
            </button>
          </div>
        )}

        {message && ( 
          <div className={`mt-4 p-4 rounded-lg border text-sm font-medium ${messageClasses}`}>
            {message.text}
          </div> 
        )}
      </div>
    </div>
  );
}
export default ImportPage;
