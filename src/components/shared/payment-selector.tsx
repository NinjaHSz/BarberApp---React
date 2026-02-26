"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Smartphone, 
  Banknote, 
  CreditCard, 
  Zap, 
  Gift, 
  ChevronDown,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "PIX", label: "PIX", icon: Smartphone },
  { value: "DINHEIRO", label: "Dinheiro", icon: Banknote },
  { value: "CARTÃO", label: "Cartão", icon: CreditCard },
  { value: "PLANO", label: "Plano", icon: Zap },
  { value: "CORTESIA", label: "Cortesia", icon: Gift },
  { value: "A DEFINIR", label: "A Definir", icon: Check },
];

export type PaymentMethod = string;

interface PaymentSelectorProps {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  className?: string;
  isCompact?: boolean;
}

export function PaymentSelector({ value, onChange, className, isCompact = false }: PaymentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = OPTIONS.find(opt => opt.value === value) || OPTIONS[OPTIONS.length - 1];
  const SelectedIcon = selectedOption.icon;

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
    <div className={cn("relative group", isCompact ? "w-auto" : "w-full", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between gap-1.5 transition-all duration-300 outline-none border-none",
          isCompact 
            ? "px-2 py-0.5 rounded-md bg-surface-subtle/40 text-[9px] font-black uppercase tracking-tight text-text-secondary hover:bg-surface-subtle" 
            : "w-full px-4 py-3 rounded-2xl bg-surface-subtle text-sm font-bold text-text-primary ring-brand-primary/20 hover:ring-1",
          isOpen && !isCompact && "ring-1 ring-brand-primary"
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          <SelectedIcon 
            size={isCompact ? 10 : 14} 
            className={cn("shrink-0", isCompact ? "text-text-muted" : "text-brand-primary")} 
          />
          <span className="truncate">{selectedOption.label}</span>
        </div>
        <ChevronDown 
          size={isCompact ? 8 : 12} 
          className={cn("transition-transform duration-300 text-text-muted/50", isOpen && "rotate-180")} 
        />
      </button>

      {isOpen && (
        <div className={cn(
          "absolute left-0 z-[500] mt-1 bg-[#121214] rounded-lg p-0.5 shadow-[0_20px_50px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-200 border border-white/[0.05] top-full",
          isCompact ? "min-w-[110px]" : "w-full min-w-[160px]"
        )}>
          <div className="max-h-60 overflow-y-auto custom-scroll">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = option.value === value;
              
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-all border-none group/item",
                    isSelected 
                      ? "bg-brand-primary text-surface-page" 
                      : "text-text-secondary hover:bg-white/[0.03] hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={isCompact ? 10 : 12} className={cn("shrink-0", isSelected ? "text-surface-page" : "text-text-muted group-hover/item:text-white")} />
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      isSelected ? "opacity-100" : "opacity-70 group-hover/item:opacity-100"
                    )}>
                      {option.label}
                    </span>
                  </div>
                  {isSelected && <Check size={10} strokeWidth={3} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


