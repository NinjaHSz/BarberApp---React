"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, subtitle, icon, children, className }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div 
            onClick={onClose}
            className="fixed inset-0 flex items-center justify-center z-[1001] p-4 bg-transparent cursor-default"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "figma-modal shadow-2xl",
                className
              )}
            >
              <div className="figma-modal-header shrink-0">
                <div className="flex items-center gap-3">
                  {icon && (
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                      {icon}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <h2 className="figma-modal-title">
                      {title}
                    </h2>
                    {subtitle && (
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="figma-modal-close border-none"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scroll w-full pr-1">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
