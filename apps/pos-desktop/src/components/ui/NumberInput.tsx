import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface NumberInputProps {
  value: number | string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  prefix?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Custom number input with Indonesian number formatting.
 * Displays formatted number (e.g. "50.000") but passes raw digits to onChange.
 */
export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  placeholder,
  className,
  prefix,
  disabled,
  autoFocus,
}) => {
  // rawValue is the unformatted digits string
  const [rawValue, setRawValue] = useState<string>(() => {
    const num = typeof value === 'number' ? value : parseFloat(String(value) || '0');
    return isNaN(num) || num === 0 ? '' : String(Math.round(num));
  });
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync rawValue when external value changes (e.g. on dialog open/reset)
  useEffect(() => {
    const num = typeof value === 'number' ? value : parseFloat(String(value) || '0');
    const newRaw = isNaN(num) || num === 0 ? '' : String(Math.round(num));
    setRawValue(newRaw);
  }, [value]);

  const formatDisplay = (raw: string): string => {
    if (!raw) return '';
    const num = parseInt(raw, 10);
    if (isNaN(num)) return '';
    return num.toLocaleString('id-ID');
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip everything except digits
    const digits = e.target.value.replace(/\D/g, '');
    setRawValue(digits);
    onChange(digits);
  }, [onChange]);

  const displayValue = isFocused ? rawValue : formatDisplay(rawValue);
  const placeholderFormatted = placeholder
    ? formatDisplay(placeholder.replace(/\D/g, ''))
    : '';

  return (
    <div className="relative flex-1">
      {prefix && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm pointer-events-none z-10">
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholderFormatted}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          'w-full bg-[#161616] border border-white/5 rounded-xl py-3 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-mono',
          prefix ? 'pl-10 pr-4' : 'px-4',
          className
        )}
      />
    </div>
  );
};
