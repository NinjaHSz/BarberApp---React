"use client";

import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect, memo, forwardRef, useImperativeHandle } from "react";

interface InlineInputProps {
  value: string | number;
  onSave: (value: string) => void;
  onNavigate?: (key: string, shift: boolean) => void;
  className?: string;
  type?: "text" | "number" | "time" | "date";
  placeholder?: string;
  prefix?: string;
  isFocused?: boolean;
  isActive?: boolean;
}

export interface InlineInputHandle {
  focus: () => void;
}

export const InlineInput = memo(forwardRef<InlineInputHandle, InlineInputProps>(function InlineInputComponent({
  value,
  onSave,
  onNavigate,
  className,
  type = "text",
  placeholder,
  prefix,
  isFocused: externalFocused,
  isActive,
}, ref) {
  const [isEditing, setIsEditing] = useState(false);
  const [internalValue, setInternalValue] = useState(String(value !== undefined && value !== null ? value : ""));
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }));

  useEffect(() => {
    setInternalValue(String(value !== undefined && value !== null ? value : ""));
  }, [value]);

  useEffect(() => {
    if (externalFocused) {
      setIsEditing(true);
    }
  }, [externalFocused]);

  const handleBlur = () => {
    setIsEditing(false);
    if (String(internalValue) !== String(value !== undefined && value !== null ? value : "")) {
      onSave(internalValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key.startsWith("Arrow")) {
      // Allow navigation to handle these
      if (onNavigate) {
        // If Enter/Tab, save first then navigate
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          handleBlur();
          onNavigate(e.key, e.shiftKey);
        } else {
          // Arrows might just navigate without blurring if not editing? 
          // Usually in Excel, arrows navigate when not typing.
          // For now, let's just pass them up.
          onNavigate(e.key, e.shiftKey);
        }
      } else if (e.key === "Enter") {
        inputRef.current?.blur();
      }
    }
    
    if (e.key === "Escape") {
      setInternalValue(String(value !== undefined && value !== null ? value : ""));
      setIsEditing(false);
    }
  };

  const hasValue = value !== undefined && value !== null && value !== "";

  if (!isEditing && type !== "time" && type !== "date") {
    return (
      <div
        ref={containerRef}
        onClick={() => setIsEditing(true)}
        tabIndex={0}
        onFocus={() => setIsEditing(true)}
        className={cn(
          "cursor-text whitespace-nowrap overflow-hidden text-ellipsis rounded px-1 -mx-1 hover:bg-white/5 transition-all min-h-[1.5em] flex items-center outline-none focus:ring-1 focus:ring-brand-primary/30",
          isActive && "bg-white/[0.05] shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-white/10",
          className
        )}
      >
        {prefix && <span className="mr-0.5 opacity-60 text-[0.8em]">{prefix}</span>}
        {hasValue ? value : <span className="text-text-muted opacity-50">{placeholder}</span>}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      autoFocus
      value={internalValue}
      onChange={(e) => setInternalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        // Excel-like: select all on focus
        e.target.select();
      }}
      className={cn(
        "bg-white/10 outline-none rounded px-1 -mx-1 w-full border-none focus:ring-1 focus:ring-brand-primary/50 text-inherit font-inherit transition-all",
        isActive && "bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]",
        className
      )}
    />
  );
}));

