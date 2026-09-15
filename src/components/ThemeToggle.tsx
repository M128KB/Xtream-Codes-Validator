import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown, Check } from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'segmented' | 'dropdown' | 'compact';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'dropdown', className = '' }) => {
  const { theme, resolvedTheme, setTheme, systemPreference } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode; sublabel?: string }[] = [
    {
      mode: 'light',
      label: 'Light',
      icon: <Sun className="w-3.5 h-3.5 text-amber-500" />,
      sublabel: 'Crisp high-contrast'
    },
    {
      mode: 'dark',
      label: 'Dark',
      icon: <Moon className="w-3.5 h-3.5 text-indigo-400" />,
      sublabel: 'Sleek OLED dark'
    },
    {
      mode: 'system',
      label: 'System Default',
      icon: <Monitor className="w-3.5 h-3.5 text-emerald-400" />,
      sublabel: `Auto (${systemPreference === 'dark' ? 'Dark' : 'Light'})`
    }
  ];

  const currentIcon =
    theme === 'light' ? (
      <Sun className="w-3.5 h-3.5 text-amber-500" />
    ) : theme === 'dark' ? (
      <Moon className="w-3.5 h-3.5 text-indigo-400" />
    ) : (
      <Monitor className="w-3.5 h-3.5 text-emerald-400" />
    );

  const currentLabel =
    theme === 'light'
      ? 'Light'
      : theme === 'dark'
      ? 'Dark'
      : `System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`;

  const isLight = resolvedTheme === 'light';

  // Segmented 3-button control (clean, modern, instant 1-click)
  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-0.5 rounded-lg border text-xs transition-colors ${
          isLight ? 'bg-slate-100 border-slate-200 shadow-inner' : 'bg-[#141418] border-[#242428]'
        } ${className}`}
        role="group"
        aria-label="Color theme selection"
      >
        {options.map((opt) => {
          const isActive = theme === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setTheme(opt.mode)}
              title={`${opt.label} - ${opt.sublabel}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/90'
                  : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
              }`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact icon-only 3-way toggle
  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center p-0.5 rounded-lg border text-xs transition-colors ${
          isLight ? 'bg-slate-100 border-slate-200 shadow-inner' : 'bg-[#141418] border-[#242428]'
        } ${className}`}
        role="group"
        aria-label="Color theme selection"
      >
        {options.map((opt) => {
          const isActive = theme === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setTheme(opt.mode)}
              title={`${opt.label} - ${opt.sublabel}`}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/90'
                  : 'text-gray-400 hover:text-white hover:bg-[#1C1C21]'
              }`}
            >
              {opt.icon}
            </button>
          );
        })}
      </div>
    );
  }

  // Dropdown variant (standard for navbar)
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer select-none ${
          isLight
            ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-950'
            : 'bg-[#16161C] hover:bg-[#202028] border-[#242428] text-gray-300 hover:text-white'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={`Theme: ${currentLabel}`}
      >
        <span className="flex items-center">{currentIcon}</span>
        <span className="hidden sm:inline">{currentLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isLight ? 'text-slate-500' : 'text-gray-400'} ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute right-0 mt-1.5 w-48 rounded-xl border shadow-xl py-1 z-50 animate-in fade-in-50 zoom-in-95 duration-100 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800'
            : 'bg-[#111114] border-[#242428] text-[#D1D1D1] shadow-2xl'
        }`}>
          <div className={`px-3 py-1.5 border-b text-[10px] uppercase font-mono tracking-wider ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-[#242428] text-gray-400'
          }`}>
            Appearance
          </div>

          <div className="p-1 space-y-0.5">
            {options.map((opt) => {
              const isSelected = theme === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => {
                    setTheme(opt.mode);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? isLight
                        ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                        : 'bg-indigo-600/15 text-indigo-300 font-semibold border border-indigo-500/20'
                      : isLight
                      ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                      : 'text-gray-300 hover:bg-[#1C1C21] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center">{opt.icon}</span>
                    <div>
                      <div className="text-[11px] leading-tight font-medium">{opt.label}</div>
                      <div className={`text-[9px] leading-tight ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{opt.sublabel}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
