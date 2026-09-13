import React from 'react';
import { LucideIcon, FolderOpen, Plus } from 'lucide-react';
import { Button } from '../shared/Button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = FolderOpen,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/80 my-4 animate-in fade-in duration-200">
      <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 shadow-xs">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
        {title}
      </h3>
      <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-4">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          variant="Primary"
          size="sm"
          onClick={onAction}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

