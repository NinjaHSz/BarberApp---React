"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option<T = string | number> {
  value: T;
  label: string;
}

interface PremiumSelectorProps<T = string | number> {
  value: T;
  options: Option<T>[];
  onSelect: (value: T) => void;
  className?: string;
  dropdownClassName?: string;
}

export function PremiumSelector<T = string | number>({
  value,
  options,
  onSelect,
  className,
  dropdownClassName,
}: PremiumSelectorProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-text-primary hover:bg-white/[0.05] transition-all outline-none border-none",
          className
        )}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown size={10} className={cn("transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full mt-2 min-w-[140px] right-0 md:right-auto bg-[#1c1c1f]/90 backdrop-blur-3xl rounded-2xl p-1.5 shadow-2xl z-[500] border-none max-h-64 overflow-y-auto custom-scroll",
            dropdownClassName
          )}
        >
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => {
                onSelect(opt.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full text-left px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                opt.value === value
                  ? "bg-brand-primary text-surface-page"
                  : "text-text-muted hover:text-white"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
