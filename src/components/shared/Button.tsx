import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 
  | 'Primary' 
  | 'Secondary' 
  | 'Destructive' 
  | 'primary' 
  | 'secondary' 
  | 'destructive'
  | 'ghost'
  | 'outline'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  // Primary Styles
  primary: 'bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white shadow-xs focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 border border-transparent disabled:bg-teal-700/60',
  Primary: 'bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white shadow-xs focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 border border-transparent disabled:bg-teal-700/60',
  
  // Secondary Styles
  secondary: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:bg-slate-100 dark:active:bg-slate-700 shadow-xs focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-50',
  Secondary: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:bg-slate-100 dark:active:bg-slate-700 shadow-xs focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-50',
  
  // Destructive Styles
  destructive: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-xs focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 border border-transparent disabled:bg-red-600/60',
  Destructive: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-xs focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 border border-transparent disabled:bg-red-600/60',
  
  // Subtle variants for icons / text links
  ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-transparent focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-40',
  outline: 'bg-transparent text-teal-700 dark:text-teal-400 border border-teal-600 dark:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/40 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-40',
  link: 'bg-transparent text-teal-700 dark:text-teal-400 hover:underline p-0 h-auto font-medium focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-40'
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm font-semibold rounded-xl gap-2',
  lg: 'px-5 py-3 text-base font-bold rounded-xl gap-2.5',
  icon: 'p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'Primary',
  size = 'md',
  isLoading = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}, ref) => {
  const isBusy = isLoading || loading;
  const isDisabled = disabled || isBusy;

  const baseClasses = 'inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer focus:outline-hidden disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] disabled:active:scale-100 font-medium whitespace-nowrap';
  const resolvedVariant = variantStyles[variant] || variantStyles.Primary;
  const resolvedSize = sizeStyles[size] || sizeStyles.md;
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isBusy}
      className={`${baseClasses} ${resolvedVariant} ${resolvedSize} ${widthClass} ${className}`.trim()}
      {...props}
    >
      {isBusy && (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      )}
      {!isBusy && leftIcon && (
        <span className="shrink-0 flex items-center">{leftIcon}</span>
      )}
      {children && (
        <span className="truncate">{children}</span>
      )}
      {!isBusy && rightIcon && (
        <span className="shrink-0 flex items-center">{rightIcon}</span>
      )}
    </button>
  );
});

Button.displayName = 'Button';
