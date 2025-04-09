// src/pages/ImportPage.tsx
import React, { JSX, useState, ChangeEvent } from 'react';
import { collection, writeBatch, Timestamp, doc } from "firebase/firestore";
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

// Define types for state and messages
type ImportStatus = 'idle' | 'reading' | 'parsing' | 'importing' | 'success' | 'error';
interface ImportMessage {
  type: 'info' | 'success' | 'error';
  text: string;
}

// Conversion factors
const KM_TO_MILES = 1 / 1.60934;

function ImportPage(): JSX.Element {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [message, setMessage] = useState<ImportMessage | null>(null);
  const [importedCount, setImportedCount] = useState<number>(0);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setStatus('idle'); // Reset status when a new file is selected
      setMessage(null);
      setImportedCount(0);
    } else {
      setSelectedFile(null);
    }
  };

  // --- Date Parsing Function ---
  // ASSUMPTION: Date format is DD/MM/YYYY. Adjust if needed.
  const parseDate = (dateString: string): Timestamp | null => {
    try {
      // Handle potential different separators and ensure correct order
      const parts = dateString.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (parts && parts.length === 4) {
        // Assuming DD/MM/YYYY format
        const day = parseInt(parts[1], 10);
        const month = parseInt(parts[2], 10) - 1; // Month is 0-indexed in JS Date
        const year = parseInt(parts[3], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const date = new Date(year, month, day);
          // Basic validation: Check if the parsed date components match the input
          if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
             return Timestamp.fromDate(date);
          }
        }
      }
      console.warn(`Could not parse date: "${dateString}"`);
      return null; // Return null if parsing fails
    } catch (e) {
      console.error(`Error parsing date "${dateString}":`, e);
      return null;
    }
  };


  const handleImport = async () => {
    if (!selectedFile || !user) {
      setMessage({ type: 'error', text: 'Please select a TSV file and ensure you are logged in.' });
      return;
    }

    setStatus('reading');
    setMessage({ type: 'info', text: 'Reading file...' });
    setImportedCount(0);

    const reader = new FileReader();

    reader.onload = async (event) => {
      if (!event.target || typeof event.target.result !== 'string') {
        setStatus('error');
        setMessage({ type: 'error', text: 'Failed to read file content.' });
        return;
      }

      try {
        setStatus('parsing');
        setMessage({ type: 'info', text: 'Parsing data...' });

        const fileContent = event.target.result;
        const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== ''); // Split lines, remove empty ones

        if (lines.length < 2) {
          throw new Error('File must contain at least a header row and one data row.');
        }

        // --- Header Mapping ---
        const headers = lines[0].split('\t').map(h => h.trim());
        const requiredHeaders = ['Date', 'Litres', 'Total Cost', 'Garage', 'Distance since fueled'];
        const headerMap: { [key: string]: number } = {};

        requiredHeaders.forEach(reqHeader => {
          const index = headers.findIndex(h => h.toLowerCase() === reqHeader.toLowerCase());
          if (index === -1) {
            throw new Error(`Missing required header column: "${reqHeader}"`);
          }
          headerMap[reqHeader] = index;
        });
        // --- End Header Mapping ---

        const logsToImport = [];
        const errors: string[] = [];

        // --- Data Row Processing ---
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split('\t');
          if (values.length < requiredHeaders.length) {
             errors.push(`Row ${i + 1}: Insufficient columns.`);
             continue; // Skip row if not enough columns
          }

          const dateStr = values[headerMap['Date']];
          const litresStr = values[headerMap['Litres']];
          const costStr = values[headerMap['Total Cost']];
          const garageStr = values[headerMap['Garage']];
          const distanceKmStr = values[headerMap['Distance since fueled']]; // Assuming Km

          // Parse and validate data
          const timestamp = parseDate(dateStr);
          const fuelAmountLiters = parseFloat(litresStr);
          const cost = parseFloat(costStr);
          const distanceKm = parseFloat(distanceKmStr);

          if (!timestamp) {
            errors.push(`Row ${i + 1}: Invalid or unparseable Date "${dateStr}".`);
            continue;
          }
          if (isNaN(fuelAmountLiters) || fuelAmountLiters <= 0) {
            errors.push(`Row ${i + 1}: Invalid Litres value "${litresStr}".`);
            continue;
          }
          if (isNaN(cost) || cost <= 0) {
            errors.push(`Row ${i + 1}: Invalid Total Cost value "${costStr}".`);
            continue;
          }
          if (isNaN(distanceKm) || distanceKm <= 0) {
            errors.push(`Row ${i + 1}: Invalid Distance value "${distanceKmStr}".`);
            continue;
          }

          // Convert distance to miles
          const distanceMiles = distanceKm * KM_TO_MILES;

          logsToImport.push({
            userId: user.uid,
            timestamp: timestamp,
            brand: garageStr.trim() || 'Unknown',
            cost: cost,
            distanceMiles: distanceMiles,
            fuelAmountLiters: fuelAmountLiters,
          });
        }
        // --- End Data Row Processing ---

        if (errors.length > 0) {
           // Optionally show only first few errors
           setMessage({ type: 'error', text: `Found ${errors.length} errors during parsing. First few: ${errors.slice(0, 5).join('; ')}` });
           setStatus('error');
           return; // Stop import if parsing errors occurred
        }

        if (logsToImport.length === 0) {
             setMessage({ type: 'info', text: 'No valid logs found to import after parsing.' });
             setStatus('idle');
             return;
        }

        // --- Firestore Batch Write ---
        setStatus('importing');
        setMessage({ type: 'info', text: `Importing ${logsToImport.length} valid logs...` });

        // Firestore allows max 500 operations per batch
        const batchSize = 499; // Keep slightly under limit for safety
        let importedCountTotal = 0;

        for (let i = 0; i < logsToImport.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = logsToImport.slice(i, i + batchSize);

            chunk.forEach((logData) => {
                const logRef = doc(collection(db, "fuelLogs")); // Create new doc ref
                batch.set(logRef, logData); // Add set operation to batch
            });

            await batch.commit(); // Commit the batch
            importedCountTotal += chunk.length;
            setMessage({ type: 'info', text: `Importing... (${importedCountTotal}/${logsToImport.length})` });
        }
        // --- End Firestore Batch Write ---

        setImportedCount(importedCountTotal);
        setStatus('success');
        setMessage({ type: 'success', text: `Successfully imported ${importedCountTotal} logs!` });

      } catch (error: any) {
        console.error("Import Error:", error);
        setStatus('error');
        setMessage({ type: 'error', text: `Import failed: ${error.message}` });
      }
    };

    reader.onerror = () => {
      setStatus('error');
      setMessage({ type: 'error', text: 'Error reading the selected file.' });
    };

    reader.readAsText(selectedFile); // Start reading the file
  };

  // Determine message styling
  const messageClasses = message?.type === 'error' ? 'text-red-600 bg-red-100' :
                         message?.type === 'success' ? 'text-green-700 bg-green-100' :
                         'text-blue-700 bg-blue-100'; // Default to info style

  return (
    <div className="container mx-auto max-w-2xl">
      <div className="bg-white shadow-lg rounded-xl p-8 border border-gray-200 space-y-6">
        <h2 className="text-2xl font-semibold text-gray-800 text-center">Import Fuel Logs</h2>

        <p className="text-sm text-gray-600">
          Select a Tab-Separated Value (.tsv or .txt) file containing your historical fuel data.
          Ensure the file has headers including at least: <code className="text-xs bg-gray-100 p-1 rounded">Date</code>, <code className="text-xs bg-gray-100 p-1 rounded">Litres</code>, <code className="text-xs bg-gray-100 p-1 rounded">Total Cost</code>, <code className="text-xs bg-gray-100 p-1 rounded">Garage</code>, and <code className="text-xs bg-gray-100 p-1 rounded">Distance since fueled</code> (assumed to be in Km).
        </p>

        {/* File Input */}
        <div>
          <label htmlFor="tsvFile" className="block text-sm font-medium text-gray-700 mb-1">
            TSV File
          </label>
          <input
            type="file"
            id="tsvFile"
            accept=".tsv,.txt,text/tab-separated-values" // Accept TSV and plain text
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 border border-gray-300 rounded-md cursor-pointer
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-md file:border-0
                       file:text-sm file:font-semibold
                       file:bg-indigo-50 file:text-indigo-700
                       hover:file:bg-indigo-100"
            disabled={status === 'reading' || status === 'parsing' || status === 'importing'}
          />
        </div>

        {/* Import Button */}
        <button
          onClick={handleImport}
          disabled={!selectedFile || !user || status === 'reading' || status === 'parsing' || status === 'importing'}
          className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          {status === 'importing' ? `Importing... (${importedCount})` :
           status === 'parsing' ? 'Parsing...' :
           status === 'reading' ? 'Reading...' :
           'Import Data'}
        </button>

        {/* Status/Result Message */}
        {message && (
          <div className={`mt-4 p-3 rounded-md text-sm ${messageClasses}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportPage;
