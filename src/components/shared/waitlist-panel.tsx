"use client";

import { useState, useEffect } from "react";
import { motion, useDragControls } from "framer-motion";
import { GripHorizontal, ChevronDown, ChevronUp, Plus, Trash2, Calendar, List } from "lucide-react";
import { AutocompleteInput, type Suggestion } from "./autocomplete-input";
import { useWaitlist, useSupabase } from "@/hooks/use-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface WaitlistPanelProps {
  dateStr: string;
  clientSuggestions: Suggestion<string>[];
  onAddAppointment: (clientName: string, timePref?: string) => void;
}

export function WaitlistPanel({
  dateStr,
  clientSuggestions,
  onAddAppointment,
}: WaitlistPanelProps) {
  const [isMinimized, setIsMinimized] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [clientInput, setClientInput] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const dragControls = useDragControls();

  if (!mounted) {
    return null;
  }

  // Fetch items from Supabase
  const { data: items = [], isLoading } = useWaitlist(dateStr);

  // Add mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!clientInput.trim()) return;
      const { error } = await supabase
        .from("lista_espera")
        .insert([
          {
            data: dateStr,
            cliente_nome: clientInput.trim(),
            sem_preferencia: true,
            hora_inicio: null,
            hora_fim: null,
          },
        ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist", dateStr] });
      setClientInput("");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lista_espera")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist", dateStr] });
    },
  });

  const handleAdd = () => {
    addMutation.mutate();
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="fixed bottom-24 md:bottom-4 right-2 md:right-4 z-[999] pointer-events-none flex flex-col items-end">
      {/* Mobile Circle Toggle Button */}
      {isMinimized && (
        <motion.button
          layout
          onClick={() => setIsMinimized(false)}
          className="md:hidden pointer-events-auto w-12 h-12 rounded-full bg-surface-section/95 backdrop-blur-2xl shadow-[0_15px_30px_rgba(0,0,0,0.6)] flex items-center justify-center border-none cursor-pointer relative hover:scale-105 active:scale-95 transition-all text-white"
        >
          <List size={20} />
          {!isLoading && items.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-primary text-surface-page font-black text-[10px] flex items-center justify-center shadow-md animate-in zoom-in duration-300">
              {items.length}
            </span>
          )}
        </motion.button>
      )}

      {/* Main Panel */}
      {(!isMinimized || (typeof window !== "undefined" && window.innerWidth >= 768)) && (
        <motion.div
          layout
          drag
          dragListener={false}
          dragControls={dragControls}
          dragMomentum={false}
          className={`${
            isMinimized ? "flex md:flex" : "flex"
          } pointer-events-auto bg-surface-section/95 backdrop-blur-2xl rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.7)] flex-col w-[260px] max-w-[90vw] overflow-hidden`}
        >
          {/* Top Grab Handle */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            className="w-full pt-2 pb-1 cursor-grab active:cursor-grabbing flex justify-center shrink-0 hover:bg-white/[0.01] transition-colors"
          >
            <div className="w-10 h-1 bg-white/10 rounded-full" />
          </div>

          {/* Form Header (Input + Plus + Collapse Button) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
            className="px-3 pb-2.5 flex gap-1.5 items-center shrink-0"
          >
            <div className="flex-1 min-w-0">
              <AutocompleteInput
                value={clientInput}
                onChange={setClientInput}
                onSelect={(item) => setClientInput(item.label)}
                suggestions={clientSuggestions}
                placeholder="Aguardando..."
                className="z-[1050]"
                inputClassName="w-full bg-surface-page/50 border-none rounded-xl px-2.5 py-1.5 text-[11px] text-text-primary focus:ring-1 focus:ring-brand-primary placeholder:text-text-muted/60"
              />
            </div>
            
            <button
              type="submit"
              disabled={!clientInput.trim() || addMutation.isPending}
              className="w-7 h-7 bg-brand-primary disabled:opacity-40 text-surface-page rounded-xl flex items-center justify-center hover:scale-[1.05] active:scale-95 transition-all border-none cursor-pointer shrink-0"
              title="Adicionar à espera"
            >
              <Plus size={12} strokeWidth={3} />
            </button>

            {/* Collapse toggle (Desktop only) */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex w-7 h-7 rounded-xl hover:bg-white/5 text-text-muted hover:text-white items-center justify-center transition-all border-none cursor-pointer shrink-0"
              title={isCollapsed ? "Expandir lista" : "Colapsar lista"}
            >
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            {/* Close button (Mobile only) */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="md:hidden w-7 h-7 rounded-xl hover:bg-white/5 text-text-muted hover:text-white flex items-center justify-center transition-all border-none cursor-pointer shrink-0"
            >
              <ChevronDown size={14} />
            </button>
          </form>

          {/* List Section */}
          {!isCollapsed && (
            <div className="px-3 pb-3 pt-1 flex flex-col gap-1.5 shrink-0">
              {isLoading ? (
                <div className="py-2 text-center text-[9px] font-black uppercase tracking-widest text-text-muted/40 italic animate-pulse">
                  Carregando fila...
                </div>
              ) : items.length === 0 ? (
                <div className="py-2 text-center text-[9px] font-black uppercase tracking-widest text-text-muted/40 italic">
                  Fila vazia
                </div>
              ) : (
                <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto custom-scroll pr-0.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-1.5 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-colors gap-2"
                    >
                      <span className="text-[10px] font-black text-white uppercase truncate flex-1 leading-none">
                        {item.cliente_nome}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => onAddAppointment(item.cliente_nome)}
                          className="p-1 rounded-md bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary hover:text-white transition-all border-none cursor-pointer"
                          title="Agendar cliente"
                        >
                          <Calendar size={10} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 transition-all border-none cursor-pointer"
                          title="Remover"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
