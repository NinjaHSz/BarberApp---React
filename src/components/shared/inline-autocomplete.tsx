"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { type Suggestion } from "./autocomplete-input";

interface InlineAutocompleteProps {
  value: string;
  placeholder?: string;
  suggestions: Suggestion<string>[];
  onSave: (value: string) => void;
  className?: string;
}

export function InlineAutocomplete({
  value,
  placeholder = "---",
  suggestions,
  onSave,
  className,
}: InlineAutocompleteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (!isEditing) setInputValue(value || "");
  }, [value, isEditing]);

  const filteredSuggestions = useMemo(() => {
    if (!inputValue) return suggestions.slice(0, 8);
    return suggestions
      .filter((s) => s.label.toLowerCase().includes(inputValue.toLowerCase()))
      .slice(0, 8);
  }, [inputValue, suggestions]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setIsOpen(suggestions.length > 0);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleSelect = (item: Suggestion<string>) => {
    setInputValue(item.label);
    setIsOpen(false);
    setIsEditing(false);
    if (item.label !== value) onSave(item.label);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setIsOpen(false);
    setIsEditing(false);
    if (inputValue !== value) onSave(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isOpen && filteredSuggestions.length > 0) {
        handleSelect(filteredSuggestions[0]);
      } else {
        setIsOpen(false);
        setIsEditing(false);
        if (inputValue !== value) onSave(inputValue);
      }
      e.preventDefault();
    }
    if (e.key === "Escape") {
      setInputValue(value || "");
      setIsOpen(false);
      setIsEditing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const matches = val
      ? suggestions.filter((s) => s.label.toLowerCase().includes(val.toLowerCase()))
      : suggestions;
    setIsOpen(matches.length > 0);
  };

  if (!isEditing) {
    return (
      <span
        onClick={handleStartEdit}
        className={cn(
          "cursor-pointer truncate block w-full hover:opacity-70 transition-opacity",
          !value && "text-text-muted/40 italic font-medium",
          className
        )}
      >
        {value || placeholder}
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full z-[200]">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(filteredSuggestions.length > 0)}
        className={cn(
          "w-full bg-surface-subtle border-none rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-brand-primary text-sm",
          className
        )}
        autoComplete="off"
      />
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c1c1f]/95 backdrop-blur-xl rounded-xl p-1 shadow-2xl z-[600] max-h-48 overflow-y-auto">
          {filteredSuggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur before click
                handleSelect(s);
              }}
              className="w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-white hover:bg-white/5 transition-all flex justify-between items-center"
            >
              <span>{s.label}</span>
              {s.subLabel && (
                <span className="text-[8px] bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded ml-2">
                  {s.subLabel}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
