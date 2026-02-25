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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 z-[100]"
          />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[101] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "w-full max-w-lg bg-surface-section rounded-[2.5rem] shadow-2xl pointer-events-auto overflow-hidden flex flex-col border-none max-h-[90vh]",
                className
              )}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-6 bg-surface-section border-none">
                <div className="flex items-center gap-4">
                  {icon && (
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                      {icon}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">
                      {title}
                    </h2>
                    {subtitle && (
                      <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mt-1">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-white transition-all border-none"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scroll px-8 pb-10">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
