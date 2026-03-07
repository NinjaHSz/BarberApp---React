"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { type Suggestion } from "./autocomplete-input";

interface InlineAutocompleteProps {
  value: string;
  placeholder?: string;
  suggestions: Suggestion<string>[];
  onSave: (value: string, item?: Suggestion<string>) => void;
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
    // Treat placeholder text as empty string to show more suggestions on focus
    const isPlaceholder = inputValue === "A DEFINIR" || inputValue === "---" || (!inputValue && !!placeholder);
    const search = isPlaceholder ? "" : inputValue;
    
    if (!search) return suggestions.slice(0, 15);
    return suggestions
      .filter((s) => s.label.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 15);
  }, [inputValue, suggestions, placeholder]);

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
    onSave(item.label, item);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setIsOpen(false);
    setIsEditing(false);
    const trimmedIn = inputValue.trim();
    const trimmedVal = (value || "").trim();
    if (trimmedIn !== trimmedVal) {
      const match = suggestions.find(s => s.label.toLowerCase().trim() === trimmedIn.toLowerCase());
      onSave(trimmedIn, match);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isOpen && filteredSuggestions.length > 0) {
        handleSelect(filteredSuggestions[0]);
      } else {
        setIsOpen(false);
        setIsEditing(false);
        const trimmedIn = inputValue.trim();
        const trimmedVal = (value || "").trim();
        if (trimmedIn !== trimmedVal) {
          const match = suggestions.find(s => s.label.toLowerCase().trim() === trimmedIn.toLowerCase());
          onSave(trimmedIn, match);
        }
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
        onFocus={() => setIsOpen(true)}
        className={cn(
          "w-full bg-surface-subtle border-none rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-brand-primary text-sm",
          className
        )}
        autoComplete="off"
      />
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1d] border border-white/10 rounded-xl p-1 shadow-2xl z-[1000] max-h-48 overflow-y-auto">
          {filteredSuggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); 
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
