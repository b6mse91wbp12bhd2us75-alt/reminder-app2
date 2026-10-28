import React, { useState, useEffect } from 'react';
import { Minus, Plus, ChevronUp, ChevronDown } from 'lucide-react';

interface NumberStepperProps {
  value: number | string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  suffix?: string;
  className?: string;
  compact?: boolean;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  min = 1,
  max = 999,
  step = 1,
  onChange,
  suffix = '',
  className = '',
  compact = false,
}) => {
  // Local string representation so the user can freely backspace and type multi-digit numbers
  const [textVal, setTextVal] = useState<string>(value !== undefined && value !== null ? value.toString() : min.toString());

  useEffect(() => {
    setTextVal(value !== undefined && value !== null ? value.toString() : min.toString());
  }, [value, min]);

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    const currentNum = parseInt(textVal, 10);
    const safeNum = isNaN(currentNum) ? min : currentNum;
    const nextNum = Math.max(min, safeNum - step);
    setTextVal(nextNum.toString());
    onChange(nextNum);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    const currentNum = parseInt(textVal, 10);
    const safeNum = isNaN(currentNum) ? min : currentNum;
    const nextNum = Math.min(max, safeNum + step);
    setTextVal(nextNum.toString());
    onChange(nextNum);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty string so user can backspace completely without jumping back to 1
    if (raw === '') {
      setTextVal('');
      return;
    }
    // Only accept numbers
    if (/^\d*$/.test(raw)) {
      setTextVal(raw);
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) {
        onChange(parsed);
      }
    }
  };

  const handleBlur = () => {
    if (textVal === '' || isNaN(parseInt(textVal, 10))) {
      setTextVal(min.toString());
      onChange(min);
    } else {
      const parsed = Math.min(max, Math.max(min, parseInt(textVal, 10)));
      setTextVal(parsed.toString());
      onChange(parsed);
    }
  };

  if (compact) {
    // Compact layout with mini buttons
    return (
      <div className={`inline-flex items-center bg-[#1e2633] border border-gray-600 rounded-xl overflow-hidden shadow-inner ${className}`}>
        <button
          type="button"
          onClick={handleDecrement}
          className="w-8 h-8 shrink-0 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 transition cursor-pointer select-none active:scale-95"
          title="減らす"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={textVal}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={(e) => e.target.select()}
          className="w-12 min-w-0 text-center bg-transparent text-white font-bold text-sm focus:outline-none focus:bg-[#3a4a5e] py-1 px-1"
        />

        <button
          type="button"
          onClick={handleIncrement}
          className="w-8 h-8 shrink-0 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 transition cursor-pointer select-none active:scale-95"
          title="増やす"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {suffix && <span className="text-xs text-gray-300 pr-2 pl-0.5 select-none shrink-0">{suffix}</span>}
      </div>
    );
  }

  // Full touch-friendly stepper
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center bg-[#1e2633] border border-gray-600 rounded-xl overflow-hidden shadow-inner flex-1 min-w-0 max-w-[130px] sm:max-w-[140px]">
        <button
          type="button"
          onClick={handleDecrement}
          className="w-8 sm:w-9 h-8 sm:h-9 shrink-0 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 transition cursor-pointer select-none font-bold active:scale-95"
          title="減らす"
        >
          <Minus className="w-4 h-4" />
        </button>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={textVal}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={(e) => e.target.select()}
          className="w-0 min-w-0 flex-1 text-center bg-transparent text-white font-black text-sm sm:text-base focus:outline-none focus:bg-[#3a4a5e] py-1 px-1 tracking-wide"
        />

        <button
          type="button"
          onClick={handleIncrement}
          className="w-8 sm:w-9 h-8 sm:h-9 shrink-0 flex items-center justify-center bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 transition cursor-pointer select-none font-bold active:scale-95"
          title="増やす"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {suffix && <span className="text-xs font-bold text-gray-200 select-none shrink-0">{suffix}</span>}
    </div>
  );
};
