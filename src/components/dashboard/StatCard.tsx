import type { JSX, ReactNode } from 'react';

/** A small labelled figure, as used in the dashboard's card rows. */
export default function StatCard({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="nocturne-card p-4 flex flex-col items-center gap-1.5">
      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 font-mono tracking-tighter">
        {children}
      </p>
    </div>
  );
}
