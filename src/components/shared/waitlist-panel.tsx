"use client";

import { useState } from "react";
import { motion, useDragControls, AnimatePresence } from "framer-motion";
import { GripHorizontal, Minimize2, Maximize2, Plus, Trash2, Calendar, Clock, List } from "lucide-react";
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
  const [clientInput, setClientInput] = useState("");
  const [noPreference, setNoPreference] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const dragControls = useDragControls();

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
            sem_preferencia: noPreference,
            hora_inicio: noPreference ? null : startTime,
            hora_fim: noPreference ? null : endTime,
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
    handleAddAction();
  };

  const handleAddAction = () => {
    addMutation.mutate();
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const displayedItems = isMinimized ? items.slice(0, 2) : items;

  if (isMinimized) {
    return (
      <div className="fixed bottom-24 md:bottom-4 right-2 md:right-4 z-[999] pointer-events-none flex flex-col items-end">
        {/* Mobile Circle Button */}
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

        {/* Desktop Minimized Panel */}
        <motion.div
          layout
          drag
          dragListener={false}
          dragControls={dragControls}
          dragMomentum={false}
          className="hidden md:flex pointer-events-auto bg-surface-section/95 backdrop-blur-2xl rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex-col w-[300px] max-w-[90vw]"
        >
          {/* Header/Drag Handle */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            className="flex items-center justify-between px-5 py-3.5 bg-white/[0.02] cursor-grab active:cursor-grabbing select-none shrink-0 rounded-t-[2rem]"
          >
            <div className="flex items-center gap-2">
              <GripHorizontal size={14} className="text-text-muted hover:text-white transition-colors" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary leading-none">
                  Lista de Espera
                </span>
                {!isLoading && items.length > 0 && (
                  <span className="text-[8px] font-black text-brand-primary uppercase tracking-wider leading-none">
                    {items.length} {items.length === 1 ? "cliente" : "clientes"}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-xl hover:bg-white/5 text-text-muted hover:text-white transition-all border-none cursor-pointer"
            >
              <Maximize2 size={12} />
            </button>
          </div>

          {/* List Section (rendered if items exist) */}
          {items.length > 0 && (
            <div className="px-5 pb-5 pt-2 flex flex-col gap-2 shrink-0">
              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto custom-scroll pr-0.5">
                {displayedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-[11px] font-black text-white uppercase truncate">
                        {item.cliente_nome}
                      </span>
                      <span className="text-[8px] font-bold text-text-muted flex items-center gap-1">
                        <Clock size={8} />
                        {item.sem_preferencia
                          ? "Qualquer horário"
                          : `${item.hora_inicio?.substring(0, 5)} - ${item.hora_fim?.substring(0, 5)}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onAddAppointment(item.cliente_nome, item.hora_inicio || undefined)}
                        className="p-1.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary hover:text-white transition-all border-none cursor-pointer"
                        title="Agendar"
                      >
                        <Calendar size={10} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 transition-all border-none cursor-pointer"
                        title="Remover"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}

                {items.length > 2 && (
                  <span className="text-[8px] font-black text-brand-primary uppercase tracking-widest text-center mt-1">
                    + {items.length - 2} outro(s) na fila
                  </span>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 md:bottom-4 right-2 md:right-4 z-[999] pointer-events-none">
      <motion.div
        layout
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        className="pointer-events-auto bg-surface-section/95 backdrop-blur-2xl rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex flex-col w-[300px] max-w-[90vw]"
      >
        {/* Header/Drag Handle */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className="flex items-center justify-between px-5 py-3.5 bg-white/[0.02] cursor-grab active:cursor-grabbing select-none shrink-0 rounded-t-[2rem]"
        >
          <div className="flex items-center gap-2">
            <GripHorizontal size={14} className="text-text-muted hover:text-white transition-colors" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary leading-none">
                Lista de Espera
              </span>
              {!isLoading && items.length > 0 && (
                <span className="text-[8px] font-black text-brand-primary uppercase tracking-wider leading-none">
                  {items.length} {items.length === 1 ? "cliente" : "clientes"}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-xl hover:bg-white/5 text-text-muted hover:text-white transition-all border-none cursor-pointer"
          >
            <Minimize2 size={12} />
          </button>
        </div>

        {/* Compact Form */}
        <AnimatePresence>
          <motion.form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 pt-2 pb-1 flex flex-col gap-2 shrink-0"
          >
            <div className="flex gap-2 items-center">
              <div className="flex-1 min-w-0">
                <AutocompleteInput
                  value={clientInput}
                  onChange={setClientInput}
                  onSelect={(item) => setClientInput(item.label)}
                  suggestions={clientSuggestions}
                  placeholder="Nome do cliente..."
                  className="z-[1050]"
                  inputClassName="w-full bg-surface-page/50 border-none rounded-xl px-3 py-1.5 text-xs text-text-primary focus:ring-1 focus:ring-brand-primary placeholder:text-text-muted/60"
                />
              </div>
              <button
                type="submit"
                disabled={!clientInput.trim() || addMutation.isPending}
                className="w-8 h-8 bg-brand-primary disabled:opacity-40 text-surface-page rounded-xl flex items-center justify-center hover:scale-[1.05] active:scale-95 transition-all border-none cursor-pointer shrink-0 animate-in fade-in"
                title="Adicionar"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>

            <div className="flex items-center justify-between text-[8px] font-black text-text-secondary uppercase tracking-widest px-1">
              <span>Sem preferência de horário</span>
              <button
                type="button"
                onClick={() => setNoPreference(!noPreference)}
                className={`w-8 h-4 rounded-full p-0.5 transition-colors border-none cursor-pointer flex ${
                  noPreference ? "bg-brand-primary justify-end" : "bg-surface-page/80 justify-start"
                }`}
              >
                <motion.div 
                  layout 
                  className={`w-3 h-3 rounded-full shadow-md ${noPreference ? "bg-surface-page" : "bg-text-muted"}`} 
                />
              </button>
            </div>

            {!noPreference && (
              <div className="flex items-center justify-between gap-2 px-1 py-1 animate-in fade-in slide-in-from-top-2 duration-300 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black text-text-muted uppercase">De</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-surface-page/50 border-none rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black text-text-muted uppercase">Até</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-surface-page/50 border-none rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                </div>
              </div>
            )}
          </motion.form>
        </AnimatePresence>

        {/* List Section */}
        <div className="px-5 pb-5 pt-2 flex flex-col gap-2 shrink-0">
          <span className="text-[8px] font-black text-text-muted uppercase tracking-[0.15em] px-1">
            Fila de Espera
          </span>

          {isLoading ? (
            <div className="py-4 text-center text-[9px] font-black uppercase tracking-widest text-text-muted/40 italic animate-pulse">
              Carregando fila...
            </div>
          ) : items.length === 0 ? (
            <div className="py-4 text-center text-[9px] font-black uppercase tracking-widest text-text-muted/40 italic">
              Nenhum cliente aguardando
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto custom-scroll pr-0.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[11px] font-black text-white uppercase truncate">
                      {item.cliente_nome}
                    </span>
                    <span className="text-[8px] font-bold text-text-muted flex items-center gap-1">
                      <Clock size={8} />
                      {item.sem_preferencia
                        ? "Qualquer horário"
                        : `${item.hora_inicio?.substring(0, 5)} - ${item.hora_fim?.substring(0, 5)}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onAddAppointment(item.cliente_nome, item.hora_inicio || undefined)}
                      className="p-1.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary hover:text-white transition-all border-none cursor-pointer"
                      title="Agendar"
                    >
                      <Calendar size={10} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 transition-all border-none cursor-pointer"
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
      </motion.div>
    </div>
  );
}
