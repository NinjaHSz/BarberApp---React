"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface Suggestion<T = unknown> {
  id: string;
  label: string;
  subLabel?: string;
  value: T;
}

interface AutocompleteInputProps<T = unknown> {
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: Suggestion<T>) => void;
  suggestions: Suggestion<T>[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function AutocompleteInput<T = unknown>({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  className,
  inputClassName,
}: AutocompleteInputProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = useMemo(() => {
    if (value.length === 0) return [];
    return suggestions.filter((s) =>
      s.label.toLowerCase().includes(value.toLowerCase())
    );
  }, [value, suggestions]);

  useEffect(() => {
    if (value.length > 0 && filteredSuggestions.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [value, filteredSuggestions.length]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isOpen && filteredSuggestions.length > 0) {
      onSelect(filteredSuggestions[0]);
      setIsOpen(false);
      e.preventDefault();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        onFocus={() => {
          if (value.length > 0 && filteredSuggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        className={cn(
          "w-full bg-surface-subtle border-none rounded-2xl px-4 py-3 text-sm text-text-primary outline-none focus:ring-1 focus:ring-brand-primary placeholder:text-text-muted",
          inputClassName
        )}
      />

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1c1c1f]/90 backdrop-blur-3xl rounded-2xl p-1.5 shadow-2xl z-[600] border-none max-h-48 overflow-y-auto custom-scroll">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => {
                onSelect(suggestion);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-white hover:bg-white/5 transition-all flex justify-between items-center"
            >
              <span>{suggestion.label}</span>
              {suggestion.subLabel && (
                <span className="text-[8px] bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded ml-2">
                  {suggestion.subLabel}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
