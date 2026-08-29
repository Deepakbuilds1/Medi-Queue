import React from 'react';
import { SearchX, RotateCcw } from 'lucide-react';

interface NoResultsStateProps {
  searchQuery?: string;
  onClearFilters: () => void;
}

export const NoResultsState: React.FC<NoResultsStateProps> = ({
  searchQuery,
  onClearFilters,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/60 my-4 animate-in fade-in duration-200">
      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 mb-2">
        <SearchX className="w-6 h-6" />
      </div>
      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
        No Matching Records Found
      </h3>
      <p className="text-[11px] text-slate-500 max-w-xs mb-3">
        {searchQuery ? `No results match "${searchQuery}".` : 'No items match your active filters.'}
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="py-1.5 px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Reset Filters</span>
      </button>
    </div>
  );
};
