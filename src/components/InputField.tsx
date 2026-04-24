import React from 'react';
import { cn } from '../lib/utils';
import { LucideIcon } from 'lucide-react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: LucideIcon;
  error?: string;
  rightElement?: React.ReactNode;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  icon: Icon,
  error,
  rightElement,
  className,
  ...props
}) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-300 ml-1">
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-orange-500">
            <Icon size={18} />
          </div>
        )}
        <input
          className={cn(
            "w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 transition-all duration-200 outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 text-white placeholder:text-gray-500",
            Icon && "pl-12",
            rightElement && "pr-12",
            error && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10",
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-400 ml-1 mt-1 animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
};
