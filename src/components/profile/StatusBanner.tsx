import type { JSX } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export interface StatusMessage {
  type: 'success' | 'error';
  text: string;
}

/** Success/error banner shown under a Profile section. */
export default function StatusBanner({ message }: { message: StatusMessage }): JSX.Element {
  return (
    <div className={`mt-6 p-4 rounded-2xl border flex items-center space-x-3 animate-in slide-in-from-bottom-2 ${message.type === 'success' ? 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' : 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'}`}>
      {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      <p className="text-sm font-bold">{message.text}</p>
    </div>
  );
}
