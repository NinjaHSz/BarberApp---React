"use client";

import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect, memo } from "react";

interface InlineInputProps {
  value: string | number;
  onSave: (value: string) => void;
  className?: string;
  type?: "text" | "number" | "time";
  placeholder?: string;
  prefix?: string;
}

export const InlineInput = memo(function InlineInputComponent({
  value,
  onSave,
  className,
  type = "text",
  placeholder,
  prefix,
}: InlineInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [internalValue, setInternalValue] = useState(String(value !== undefined && value !== null ? value : ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInternalValue(String(value !== undefined && value !== null ? value : ""));
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (String(internalValue) !== String(value !== undefined && value !== null ? value : "")) {
      onSave(internalValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setInternalValue(String(value !== undefined && value !== null ? value : ""));
      setIsEditing(false);
    }
  };

  const hasValue = value !== undefined && value !== null && value !== "";

  if (!isEditing && type !== "time") {
    return (
      <div
        onClick={() => setIsEditing(true)}
        className={cn(
          "cursor-text whitespace-nowrap overflow-hidden text-ellipsis rounded px-1 -mx-1 hover:bg-white/5 transition-all min-h-[1.5em] flex items-center",
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
      onFocus={(e) => e.target.select()}
      className={cn(
        "bg-white/10 outline-none rounded px-1 -mx-1 w-full border-none focus:ring-1 focus:ring-brand-primary/50 text-inherit font-inherit",
        className
      )}
    />
  );
});
