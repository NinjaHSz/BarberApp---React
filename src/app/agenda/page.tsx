"use client";

import { useClients, useProcedures, useBarbers } from "@/hooks/use-data";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Eye, 
  EyeOff, 
  Search, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  CalendarPlus,
  Edit,
  Copy,
  Check,
  Sun,
  CloudSun,
  RotateCcw,
  List,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import React, { useState, useMemo, useCallback, memo, useDeferredValue, useEffect, useRef } from "react";
import { 
  format, 
  addDays, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  parse,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { PremiumSelector } from "@/components/shared/premium-selector";
import { InlineInput } from "@/components/shared/inline-input";
import { InlineAutocomplete } from "@/components/shared/inline-autocomplete";
import { Modal } from "@/components/shared/modal";
import { type Suggestion } from "@/components/shared/autocomplete-input";
import { PaymentSelector } from "@/components/shared/payment-selector";
import Link from "next/link";
import { AppointmentForm } from "./AppointmentForm";
import { WaitlistPanel } from "@/components/shared/waitlist-panel";
import { useAgenda } from "@/lib/contexts/agenda-context";

// --- Types ---
interface Appointment {
  id: string;
  date: string;
  time: string;
  client: string;
  service: string;
  observations?: string;
  value: number;
  paymentMethod: string;
  isEmpty?: boolean;
  barberId?: number;
  whatsappSent?: boolean;
}

// --- Helpers ---
const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn("navigator.clipboard failed, trying fallback", e);
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Fallback copy failed", err);
    document.body.removeChild(textArea);
    return false;
  }
};

// --- Components ---

const RecordRow = memo(function RecordRowComponent({ 
  record, 
  onUpdate, 
  onCancel, 
  onAdd,
  onEdit,
  onSendWhatsApp,
  clientSuggestions,
  serviceSuggestions,
  clients,
  procedures,
}: { 
  record: Appointment; 
  onUpdate: (id: string, updates: Partial<Appointment>) => void; 
  onCancel: (record: Appointment) => void;
  onAdd: (time: string, date: string, barberId?: number) => void;
  onEdit: (record: Appointment) => void;
  onSendWhatsApp: (record: any) => void | Promise<void>;
  clientSuggestions: Suggestion<string>[];
  serviceSuggestions: Suggestion<string>[];
  clients: any[];
  procedures: any[];
}) {
  const isEmpty = record.isEmpty;
  const isBreak = record.client === "PAUSA";
  const handleWhatsAppClick = () => {
    onSendWhatsApp(record);
  };

  const clientObj = useMemo(() => {
    if (isEmpty || isBreak) return null;
    return (clients || []).find((c) => c.nome?.toLowerCase() === record.client?.toLowerCase());
  }, [clients, record.client, isEmpty, isBreak]);
  const hasPhone = !!clientObj?.telefone;

  const handleClientSave = async (clientName: string) => {
    const cleanName = (clientName || "").trimEnd();
    if (cleanName.toUpperCase() === "PAUSA") {
      onUpdate(record.id, {
        client: "PAUSA",
        service: "RESERVADO",
        value: 0,
        paymentMethod: "CORTESIA",
        observations: "Horário reservado/pausa"
      });
      return;
    }
    const updates: Partial<Appointment> = { client: cleanName || "---" };
    const match = clients.find(
      (c) => c.nome?.toLowerCase() === cleanName?.toLowerCase()
    );
    if (match?.plano && match.plano !== "Nenhum" && match.plano !== "Pausado") {
      const today = record.date || format(new Date(), "yyyy-MM-dd");
      const renewDate = match.plano_pagamento;
      const isRenewalDay = renewDate === today;
      // 1. Find the latest "RENOVAÇÃO" date
      const { data: latestRenov } = await supabase
        .from("agendamentos")
        .select("data")
        .ilike("cliente", match.nome)
        .ilike("procedimento", "%renova%")
        .order("data", { ascending: false })
        .limit(1);

      const dbRenovDate = latestRenov?.[0]?.data;
      const manualResetDate = match.plano_pagamento;

      // The cycle starts at the LATEST of the last physical renovation or the manual reset date
      let startDate = dbRenovDate;
      if (!startDate || (manualResetDate && manualResetDate > startDate)) {
        startDate = manualResetDate;
      }

      // 2. Count usage since that dynamic start
      let qUsage = supabase
        .from("agendamentos")
        .select("data, procedimento")
        .ilike("cliente", match.nome)
        .neq("cliente", "PAUSA"); 
      
      if (startDate) {
        qUsage = qUsage.gte("data", startDate);
      }
      // Count only days STRICTLY BEFORE the date being scheduled
      qUsage = qUsage.lt("data", today);
      
      const { data: usageData } = await qUsage;
      
      const filteredUsage = (usageData || []).filter(u => {
        const proc = (u.procedimento || "").toUpperCase().trim();
        if (proc === "RENOVAÇÃO 1º DIA") return true;
        return /^(\d+)º\s*DIA$/.test(proc);
      });

      const usedSoFar = filteredUsage.length;
      const limite = match.limite_cortes || 0;
      
      const nextDay = usedSoFar + 1;
      const isRenew = isRenewalDay || (limite > 0 && usedSoFar >= limite) || nextDay === 1;
      updates.service = isRenew ? "RENOVAÇÃO 1º DIA" : `${nextDay}º DIA`;
      updates.paymentMethod = isRenew ? "PIX" : "PLANO";
      if (isRenew && match.valor_plano) updates.value = match.valor_plano;
    } else if (match?.preset) {
      if (match.preset.service) updates.service = match.preset.service;
      if (match.preset.value) updates.value = parseFloat(match.preset.value) || 0;
      if (match.preset.payment) updates.paymentMethod = match.preset.payment;
    }
    onUpdate(record.id, updates);
  };

  return (
    <>
        <div className={cn(
        "hidden md:grid md:grid-cols-[85px_1.5fr_1.2fr_1fr_100px_140px_110px] md:gap-0 items-stretch px-6 h-12 transition-colors group relative border-none focus-within:z-[500] z-[1]",
        isBreak ? "bg-surface-subtle" : "hover:bg-white/[0.02]"
      )}>
        {/* Horário */}
        <div className="h-full flex items-center px-4 transition-all focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-primary relative">
          <input 
            type="time" 
            defaultValue={record.time.substring(0, 5)}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== record.time.substring(0, 5)) {
                onUpdate(record.id, { time: e.target.value });
              }
            }}
            className="bg-transparent border-none outline-none focus:ring-0 rounded w-full text-xs font-bold text-text-primary/80 transition-all cursor-pointer"
          />
        </div>

        {/* Cliente */}
        <div className="h-full flex items-center px-4 transition-all focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-primary relative min-w-0">
          <div className="flex items-center gap-[3px] w-full min-w-0 h-full">
            {(() => {
              const clientObj = !isEmpty && !isBreak ? clients.find(
                (c) => c.nome?.toLowerCase() === record.client?.toLowerCase()
              ) : null;
              
              const isUnregistered = !isEmpty && !isBreak && !clientObj;

              return (
                <>
                  <InlineAutocomplete
                    value={isEmpty ? "" : (isBreak ? "PAUSA" : record.client)}
                    placeholder={isEmpty ? "---" : "Cliente..."}
                    suggestions={isBreak ? [] : clientSuggestions}
                    onSave={handleClientSave}
                    className={cn(
                      "text-sm font-bold uppercase w-full inline-block truncate h-full flex items-center",
                      isBreak 
                        ? "text-text-muted" 
                        : isEmpty 
                        ? "text-text-muted/40 italic font-medium" 
                        : isUnregistered
                        ? "text-yellow-500/70"
                        : "text-text-primary"
                    )}
                  />
                  {!isEmpty && !isBreak && (
                    isUnregistered ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onUpdate(record.id, { client: record.client });
                        }}
                        className="p-0.5 text-yellow-500/70 hover:text-yellow-400 transition-all shrink-0 border-none bg-transparent cursor-pointer"
                        title={`Cadastrar ${record.client}`}
                      >
                        <Plus size={13} strokeWidth={2.5} />
                      </button>
                    ) : (
                      <Link
                        href={`/clientes/${clientObj.id}`}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-brand-primary/50 hover:text-brand-primary transition-all shrink-0"
                        title={`Ver perfil de ${record.client}`}
                      >
                        <ExternalLink size={13} strokeWidth={2.5} />
                      </Link>
                    )
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Serviço */}
        <div className="h-full flex items-center px-4 transition-all focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-primary relative min-w-0">
          <InlineAutocomplete
            value={isEmpty ? "" : (isBreak ? "RESERVADO" : record.service)}
            placeholder={isEmpty ? "A DEFINIR" : "Serviço..."}
            suggestions={isBreak ? [] : serviceSuggestions}
            onSave={(val, item) => {
              const trimmed = val?.trim() || "";
              const formattedVal = /^\d+$/.test(trimmed) ? `${trimmed}º DIA` : val;
              const updates: Partial<Appointment> = { service: formattedVal || "A DEFINIR" };
              const match = procedures.find(p => p.nome?.toLowerCase().trim() === formattedVal?.toLowerCase().trim());
              if (match) {
                updates.value = match.preco ?? match.valor ?? 0;
              } 
              else if (item?.subLabel) {
                 const raw = item.subLabel.replace("R$ ", "").replace(/\./g, "").replace(",", ".");
                 const price = parseFloat(raw);
                 if (!isNaN(price)) updates.value = price;
              }
              onUpdate(record.id, updates);
            }}
            className={cn(
              "text-sm uppercase font-medium w-full h-full flex items-center",
              isBreak ? "text-text-muted italic" : isEmpty ? "text-text-muted/40" : record.service === "A DEFINIR" ? "text-rose-500 font-black" : "text-text-primary"
            )}
          />
        </div>

        {/* Observações */}
        <div className="h-full flex items-center px-4 transition-all focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-primary relative min-w-0">
           <InlineInput 
            value={isEmpty || isBreak ? "" : (record.observations || "")} 
            placeholder={isEmpty || isBreak ? "---" : "Nenhuma obs..."}
            onSave={(val) => onUpdate(record.id, { observations: val })}
            className="truncate w-full h-full flex items-center text-xs text-text-secondary italic"
          />
        </div>

        {/* Valor */}
        <div className="h-full flex items-center px-4 transition-all focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-primary relative">
          <InlineInput 
            type="number"
            prefix={isEmpty || isBreak ? undefined : "R$"}
            value={isEmpty || isBreak ? "" : record.value} 
            placeholder={isEmpty || isBreak ? "---" : "0.00"}
            onSave={(val) => onUpdate(record.id, { value: parseFloat(val) || 0 })}
            className="w-full h-full flex items-center text-sm font-bold text-brand-primary/90"
          />
        </div>

        {/* Pagamento */}
        <div className="h-full flex items-center px-4 transition-all focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-primary relative">
          {isBreak ? (
            <span className="text-[10px] font-black text-text-muted uppercase">N/A</span>
          ) : (
            <div className={cn("relative w-full", isEmpty && "opacity-0 group-hover:opacity-100")}>
              <PaymentSelector
                value={record.paymentMethod || ""}
                onChange={(val) => onUpdate(record.id, { paymentMethod: val })}
                isCompact
              />
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="h-full flex items-center justify-end px-4 gap-1.5 transition-all relative">
          {!isEmpty ? (
            <>
              {hasPhone && (
                <button 
                  onClick={handleWhatsAppClick}
                  className={cn(
                    "w-8 h-8 rounded-xl bg-white/5 transition-all flex items-center justify-center border-none shrink-0",
                    record.whatsappSent 
                      ? "text-yellow-500 hover:bg-yellow-500 hover:text-surface-page" 
                      : "text-[#25D366]/70 hover:bg-[#25D366] hover:text-surface-page"
                  )}
                  title="Copiar Lembrete WhatsApp"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-current">
                    <path d="M17.472 14.382C17.175 14.233 15.714 13.515 15.442 13.415C15.169 13.316 14.971 13.267 14.772 13.565C14.575 13.862 14.005 14.531 13.832 14.729C13.659 14.928 13.485 14.952 13.188 14.804C12.891 14.654 11.933 14.341 10.798 13.329C9.91501 12.541 9.31801 11.568 9.14501 11.27C8.97201 10.973 9.12701 10.812 9.27501 10.664C9.40901 10.531 9.57301 10.317 9.72101 10.144C9.87001 9.97004 9.91901 9.84604 10.019 9.64704C10.118 9.44904 10.069 9.27604 9.99401 9.12704C9.91901 8.97804 9.32501 7.51504 9.07801 6.92004C8.83601 6.34104 8.59101 6.42004 8.40901 6.41004C8.23601 6.40204 8.03801 6.40004 7.83901 6.40004C7.64101 6.40004 7.31901 6.47404 7.04701 6.77204C6.77501 7.06904 6.00701 7.78804 6.00701 9.25104C6.00701 10.713 7.07201 12.126 7.22001 12.325C7.36901 12.523 9.31601 15.525 12.297 16.812C13.006 17.118 13.559 17.301 13.991 17.437C14.703 17.664 15.351 17.632 15.862 17.555C16.433 17.47 17.62 16.836 17.868 16.142C18.116 15.448 18.116 14.853 18.041 14.729C17.967 14.605 17.77 14.531 17.472 14.382ZM12.05 21.785H12.046C10.2758 21.7852 8.53809 21.3092 7.01501 20.407L6.65401 20.193L2.91301 21.175L3.91101 17.527L3.67601 17.153C2.68645 15.5773 2.16295 13.7537 2.16601 11.893C2.16701 6.44304 6.60201 2.00904 12.054 2.00904C14.694 2.00904 17.176 3.03904 19.042 4.90704C19.9627 5.82366 20.6924 6.91377 21.189 8.11428C21.6856 9.3148 21.9392 10.6019 21.935 11.901C21.932 17.351 17.498 21.785 12.05 21.785ZM20.463 3.48804C19.3612 2.37896 18.0502 1.49958 16.6061 0.900841C15.162 0.302105 13.6133 -0.00407625 12.05 4.09775e-05C5.49501 4.09775e-05 0.160007 5.33504 0.157007 11.892C0.157007 13.988 0.704007 16.034 1.74501 17.837L0.0570068 24L6.36201 22.346C8.1056 23.296 10.0594 23.7938 12.045 23.794H12.05C18.604 23.794 23.94 18.459 23.943 11.901C23.9478 10.3383 23.6428 8.79014 23.0454 7.34607C22.4481 5.90201 21.5704 4.59071 20.463 3.48804Z" fill="currentColor"/>
                  </svg>
                </button>
              )}
              <button 
                onClick={() => onEdit(record)}
                className="w-8 h-8 rounded-xl bg-white/5 text-text-secondary hover:bg-brand-primary hover:text-surface-page transition-all flex items-center justify-center border-none shrink-0"
              >
                <Edit size={14} />
              </button>
              <button 
                onClick={() => onCancel(record)}
                className="w-8 h-8 rounded-xl bg-white/5 text-rose-500/50 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border-none shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : (
            <button 
              onClick={() => onAdd(record.time, record.date, record.barberId ? Number(record.barberId) : undefined)}
              className="px-3 h-8 rounded-xl bg-white/5 text-[10px] font-black uppercase text-brand-primary hover:bg-brand-primary hover:text-surface-page transition-all border-none shrink-0"
            >
              Agendar
            </button>
          )}
        </div> 
      </div>

      <div className="md:hidden grid grid-cols-[55px_1fr_auto] gap-2 items-center px-4 py-2.5 bg-surface-section/40 rounded-2xl mx-3.5 my-1 border-none focus-within:z-[100] z-[1]">
        <div className="text-xs text-text-primary font-bold">
          {record.time.substring(0, 5)}
        </div>
        <div className={cn("text-xs font-black truncate uppercase", isEmpty ? "text-text-muted" : "text-white")}>
          {isBreak ? "PAUSA" : record.client}
        </div>
        <div className="flex justify-end items-center gap-1.5">
          {!isEmpty ? (
            <div className="flex gap-1.5">
               {hasPhone && (
                 <button 
                   onClick={() => onSendWhatsApp(record)} 
                   className={cn(
                     "w-7 h-7 flex items-center justify-center rounded-lg bg-surface-subtle active:scale-90 border-none",
                     record.whatsappSent ? "text-yellow-500" : "text-[#25D366]/70"
                   )}
                 >
                   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-current">
                     <path d="M17.472 14.382C17.175 14.233 15.714 13.515 15.442 13.415C15.169 13.316 14.971 13.267 14.772 13.565C14.575 13.862 14.005 14.531 13.832 14.729C13.659 14.928 13.485 14.952 13.188 14.804C12.891 14.654 11.933 14.341 10.798 13.329C9.91501 12.541 9.31801 11.568 9.14501 11.27C8.97201 10.973 9.12701 10.812 9.27501 10.664C9.40901 10.531 9.57301 10.317 9.72101 10.144C9.87001 9.97004 9.91901 9.84604 10.019 9.64704C10.118 9.44904 10.069 9.27604 9.99401 9.12704C9.91901 8.97804 9.32501 7.51504 9.07801 6.92004C8.83601 6.34104 8.59101 6.42004 8.40901 6.41004C8.23601 6.40204 8.03801 6.40004 7.83901 6.40004C7.64101 6.40004 7.31901 6.47404 7.04701 6.77204C6.77501 7.06904 6.00701 7.78804 6.00701 9.25104C6.00701 10.713 7.07201 12.126 7.22001 12.325C7.36901 12.523 9.31601 15.525 12.297 16.812C13.006 17.118 13.559 17.301 13.991 17.437C14.703 17.664 15.351 17.632 15.862 17.555C16.433 17.47 17.62 16.836 17.868 16.142C18.116 15.448 18.116 14.853 18.041 14.729C17.967 14.605 17.77 14.531 17.472 14.382ZM12.05 21.785H12.046C10.2758 21.7852 8.53809 21.3092 7.01501 20.407L6.65401 20.193L2.91301 21.175L3.91101 17.527L3.67601 17.153C2.68645 15.5773 2.16295 13.7537 2.16601 11.893C2.16701 6.44304 6.60201 2.00904 12.054 2.00904C14.694 2.00904 17.176 3.03904 19.042 4.90704C19.9627 5.82366 20.6924 6.91377 21.189 8.11428C21.6856 9.3148 21.9392 10.6019 21.935 11.901C21.932 17.351 17.498 21.785 12.05 21.785ZM20.463 3.48804C19.3612 2.37896 18.0502 1.49958 16.6061 0.900841C15.162 0.302105 13.6133 -0.00407625 12.05 4.09775e-05C5.49501 4.09775e-05 0.160007 5.33504 0.157007 11.892C0.157007 13.988 0.704007 16.034 1.74501 17.837L0.0570068 24L6.36201 22.346C8.1056 23.296 10.0594 23.7938 12.045 23.794H12.05C18.604 23.794 23.94 18.459 23.943 11.901C23.9478 10.3383 23.6428 8.79014 23.0454 7.34607C22.4481 5.90201 21.5704 4.59071 20.463 3.48804Z" fill="currentColor"/>
                   </svg>
                 </button>
               )}
               <button onClick={() => onEdit(record)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-subtle text-text-secondary active:scale-90 border-none">
                 <Edit size={13} />
               </button>
               <button onClick={() => onCancel(record)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-subtle text-text-secondary active:scale-90 border-none">
                 <Trash2 size={13} />
               </button>
            </div>
          ) : (
            <button 
              onClick={() => onAdd(record.time, record.date, record.barberId ? Number(record.barberId) : undefined)}
              className="px-2.5 py-1.5 rounded-lg bg-text-primary text-surface-page text-[9px] font-black uppercase active:scale-95 border-none"
            >
              Agendar
            </button>
          )}
        </div>
      </div>
    </>
  );
});

// --- Main Page ---

export default function AgendaPage() {
  const { selectedDate: currentDate, setSelectedDate: setCurrentDate } = useAgenda();
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [showEmptySlots, setShowEmptySlots] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSlots, setCopiedSlots] = useState<string[]>([]);
  const [periodFilterName, setPeriodFilterName] = useState("");
  const [lastAction, setLastAction] = useState<{ type: string, data: any } | null>(null);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [periodFilter, setPeriodFilter] = useState("todos");
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);

  const { data: barbers = [] } = useBarbers();
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);

  useEffect(() => {
    if (barbers.length > 0 && !selectedBarberId) {
      const lucas = barbers.find((b: any) => b.nome?.toLowerCase() === "lucas");
      setSelectedBarberId(lucas ? lucas.id : barbers[0].id);
    }
  }, [barbers, selectedBarberId]);

  useEffect(() => {
    if (!showCopyMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setShowCopyMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCopyMenu]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Partial<Appointment> | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [recordToCancel, setRecordToCancel] = useState<Appointment | null>(null);

  // State for automatic client registration confirmation popup
  const [pendingRegistration, setPendingRegistration] = useState<{
    clientName: string;
    onConfirm: () => void;
    onCancelAction: () => void;
  } | null>(null);

  const registerClientMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("clientes").insert([{ 
        nome: name.trimEnd(),
        telefone: "",
        plano: "Nenhum",
        valor_plano: 0,
        limite_cortes: 0,
        observacoes_cliente: ""
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    }
  });

  const queryClient = useQueryClient();
  const selectedDateStr = format(currentDate, "yyyy-MM-dd");

  const { data: clients } = useClients();
  const { data: procedures } = useProcedures();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["records", selectedDateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("data", selectedDateStr)
        .order("horario", { ascending: true });
      if (error) throw error;
      return (data || []).map((r: any) => {
        let barberId = r.barbeiro_id;
        if (!barberId && r.barbeiro && barbers.length > 0) {
          const matchedBarber = barbers.find((b: any) => b.nome?.toLowerCase() === r.barbeiro?.toLowerCase());
          if (matchedBarber) {
            barberId = matchedBarber.id;
          }
        }
        return {
          id: String(r.id), 
          date: r.data, 
          time: r.horario, 
          client: r.cliente,
          service: r.procedimento || "A DEFINIR", 
          observations: r.observacoes,
          value: r.valor, 
          paymentMethod: r.forma_pagamento,
          barberId: barberId,
          whatsappSent: r.whatsapp_enviado || false
        } as Appointment;
      });
    },
    staleTime: 1000 * 60 * 2,
  });

  const filteredRecords = useMemo(() => {
    if (!selectedBarberId) return records;
    return records.filter((r: Appointment) => r.barberId !== undefined && String(r.barberId) === String(selectedBarberId));
  }, [records, selectedBarberId]);

  const clientSuggestions: Suggestion<string>[] = useMemo(() => 
    clients?.map(c => ({ id: c.id, label: c.nome, value: c.nome })) || [], [clients]
  );
  
  const serviceSuggestions: Suggestion<string>[] = useMemo(() => 
    procedures?.map(p => ({ 
      id: String(p.id), 
      label: p.nome, 
      value: p.nome, 
      subLabel: (p.preco !== undefined && p.preco !== null) 
        ? `R$ ${p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
        : undefined 
    })) || [], [procedures]
  );

  const updateMutation = useMutation({
    mutationFn: async ({ id: rawId, updates, dateStr, barberId }: { id: string, updates: Partial<Appointment>, dateStr: string, barberId?: string | number | null }) => {
      const id = String(rawId);
      const dbUpdates: any = {};
      if (updates.client !== undefined) {
        dbUpdates.cliente = typeof updates.client === "string" ? updates.client.trimEnd() : updates.client;
      }
      if (updates.service !== undefined) {
        const trimmed = String(updates.service).trim();
        dbUpdates.procedimento = /^\d+$/.test(trimmed) ? `${trimmed}º DIA` : updates.service;
      }
      if (updates.value !== undefined) dbUpdates.valor = updates.value;
      if (updates.observations !== undefined) dbUpdates.observacoes = updates.observations;
      if (updates.paymentMethod !== undefined) dbUpdates.forma_pagamento = updates.paymentMethod;
      if (updates.time !== undefined) dbUpdates.horario = updates.time;
      if (updates.date !== undefined) dbUpdates.data = updates.date;
      if (updates.whatsappSent !== undefined) dbUpdates.whatsapp_enviado = updates.whatsappSent;
 
      const activeBarberId = updates.barberId !== undefined ? updates.barberId : (barberId || selectedBarberId);
      const matchedBarber = barbers.find((b: any) => String(b.id) === String(activeBarberId));
      const barberName = matchedBarber ? matchedBarber.nome : null;
      const barberIdNum = matchedBarber ? Number(matchedBarber.id) : (activeBarberId ? Number(activeBarberId) : null);
 
      if (updates.barberId !== undefined) {
        dbUpdates.barbeiro_id = updates.barberId;
        if (matchedBarber) {
          dbUpdates.barbeiro = matchedBarber.nome;
        }
      }
 
      const tableName = barberIdNum === 3 ? "agendamentos_joao_lucas" : "agendamentos_lucas";
 
      if (id.startsWith('empty-')) {
        const cleanInsertName = typeof updates.client === "string" ? updates.client.trimEnd() : (updates.client || "---");
        const serviceVal = String(updates.service || "A DEFINIR").trim();
        const formattedService = /^\d+$/.test(serviceVal) ? `${serviceVal}º DIA` : (updates.service || "A DEFINIR");
        const { data, error } = await supabase.from(tableName).insert({
          cliente: cleanInsertName,
          procedimento: formattedService,
          valor: updates.value || 0,
          forma_pagamento: updates.paymentMethod || "PIX",
          observacoes: updates.observations || "",
          data: updates.date || dateStr,
          horario: updates.time || id.replace('empty-', ''),
          barbeiro_id: barberIdNum,
          barbeiro: barberName
        }).select().single();
        if (error) throw error;
        return data; // Retorna o registro criado com o ID real
      } else {
        const queryId = /^\d+$/.test(id) ? parseInt(id, 10) : id;
        const { error } = await supabase.from(tableName).update(dbUpdates).eq('id', queryId);
        if (error) throw error;
        return null;
      }
    },
    onSuccess: (data, variables) => {
      console.log('[AGENDA] updateMutation onSuccess, refetching:', variables.dateStr);
      
      // Se foi uma inserção (agendamento novo), salvamos o ID real para o Rebobinar
      if (variables.id.startsWith('empty-') && data?.id) {
        const activeBarberId = variables.updates.barberId || variables.barberId || selectedBarberId;
        setLastAction({ type: "agendar", data: { id: data.id, time: data.horario, client: data.cliente, barberId: activeBarberId } });
      }
      
      queryClient.refetchQueries({ queryKey: ["records", variables.dateStr] });
    },
    onError: (error) => {
      console.error('[AGENDA] updateMutation ERRO:', error);
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id: rawId, barberId }: { id: string, barberId?: string | number | null }) => {
      const id = String(rawId);
      const tableName = Number(barberId) === 3 ? "agendamentos_joao_lucas" : "agendamentos_lucas";
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      console.log('[AGENDA] cancelMutation onSuccess, refetching all records');
      queryClient.refetchQueries({ queryKey: ["records"] });
    },
    onError: (error) => {
      console.error('[AGENDA] cancelMutation ERRO:', error);
    }
  });

  const recordsRef = useRef<Appointment[]>(filteredRecords);
  useEffect(() => {
    recordsRef.current = filteredRecords;
  }, [filteredRecords]);



  const handleUndo = async () => {
    if (!lastAction) return;

    const barberId = lastAction.data.barberId;
    const tableName = Number(barberId) === 3 ? "agendamentos_joao_lucas" : "agendamentos_lucas";

    if (lastAction.type === "agendar") {
       if (lastAction.data.id) {
         await supabase.from(tableName).delete().eq('id', lastAction.data.id);
       }
    } else if (lastAction.type === "cancelar" || lastAction.type === "editar") {
       const data = lastAction.data;
       const dbRecord: any = {
         cliente: data.client,
         procedimento: data.service,
         valor: data.value,
         forma_pagamento: data.paymentMethod,
         observacoes: data.observations,
         data: data.date,
         horario: data.time,
         barbeiro: data.barbeiro,
         barbeiro_id: data.barberId
       };

       if (lastAction.type === "cancelar") {
         await supabase.from(tableName).insert([dbRecord]);
       } else {
         await supabase.from(tableName).update(dbRecord).eq('id', data.id);
       }
    }

    queryClient.invalidateQueries({ queryKey: ["records"] });
    setLastAction(null);
    setCopied(false);
  };

  const handleUpdate = useCallback((id: string, updates: Partial<Appointment>) => {
    const match = recordsRef.current.find(r => r.id === id);
    if (match) {
      setLastAction({ type: "editar", data: { ...match } });
    }
    const barberId = match ? match.barberId : undefined;

    const proceedUpdate = (shouldRegister: boolean) => {
      const finalUpdates = { ...updates };
      
      const runMutate = () => {
        updateMutation.mutate({ id, updates: finalUpdates, dateStr: selectedDateStr, barberId });
        setPendingRegistration(null);
      };

      if (shouldRegister && updates.client) {
        registerClientMutation.mutate(updates.client, {
          onSuccess: () => {
            runMutate();
          }
        });
      } else {
        runMutate();
      }
    };

    const cleanClientName = updates.client?.trimEnd();
    if (cleanClientName && cleanClientName !== "---" && cleanClientName.toUpperCase() !== "PAUSA") {
      const exists = clients?.some((c: any) => c.nome?.toLowerCase() === cleanClientName.toLowerCase());
      if (!exists) {
        setPendingRegistration({
          clientName: cleanClientName,
          onConfirm: () => proceedUpdate(true),
          onCancelAction: () => proceedUpdate(false)
        });
        return;
      }
    }

    proceedUpdate(false);
  }, [updateMutation, selectedDateStr, clients]);

  const handleCancel = useCallback((record: Appointment) => {
    setRecordToCancel(record);
    setIsCancelModalOpen(true);
  }, []);

  const handleSendWhatsApp = useCallback(async (record: Appointment) => {
    try {
      let dateFormatted = record.date;
      let dateLabel = "";
      try {
        const appointmentDate = parse(record.date, "yyyy-MM-dd", new Date());
        dateFormatted = format(appointmentDate, "dd/MM/yyyy");

        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const appointmentDateStr = format(appointmentDate, "yyyy-MM-dd");
        const todayStr = format(today, "yyyy-MM-dd");
        const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

        if (appointmentDateStr === todayStr) {
          dateLabel = "Hoje";
        } else if (appointmentDateStr === tomorrowStr) {
          dateLabel = "Amanhã";
        } else {
          dateLabel = `dia ${format(appointmentDate, "dd/MM")}`;
        }
      } catch (e) {
        console.error(e);
        dateLabel = `dia ${dateFormatted}`;
      }

      const messageText = `Passando para lembrar do seu agendamento aqui em Lucas do Corte Barbearia. Podemos confirmar? ${dateLabel} às ${record.time.substring(0, 5)}`;

      const clientObj = (clients || []).find(
        (c: any) => c.nome?.toLowerCase() === record.client?.toLowerCase()
      );
      const phone = clientObj?.telefone;

      if (phone) {
        let cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.length > 0 && !cleanPhone.startsWith("55")) {
          cleanPhone = "55" + cleanPhone;
        }
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`, "_blank");
        setPeriodFilterName("Lembrete no WhatsApp");
      } else {
        const success = await copyToClipboard(messageText);
        if (!success) {
          throw new Error("Copy failed");
        }
        setPeriodFilterName("Lembrete Copiado");
      }

      setCopiedSlots([`${record.time.substring(0, 5)} — ${record.client.toUpperCase()}`]);
      setCopied(true);
      
      updateMutation.mutate({
        id: record.id,
        updates: { whatsappSent: true },
        dateStr: selectedDateStr,
        barberId: record.barberId
      });
    } catch (error) {
      console.error(error);
      setPeriodFilterName("Erro no Lembrete");
      setCopiedSlots(["Falha ao processar ação"]);
      setCopied(true);
    }

    setTimeout(() => {
      setCopied(false);
      setCopiedSlots([]);
      setPeriodFilterName("");
    }, 3000);
  }, [selectedDateStr, updateMutation, clients]);

  const confirmCancel = () => {
    if (recordToCancel) {
      setLastAction({ type: "cancelar", data: { ...recordToCancel } });
      cancelMutation.mutate({ id: recordToCancel.id, barberId: recordToCancel.barberId });
      setIsCancelModalOpen(false);
      
      // Notificação de Sucesso (Compacta)
      setPeriodFilterName("Cancelado com Sucesso");
      setCopiedSlots([`${recordToCancel.time.substring(0, 5)} — ${recordToCancel.client.toUpperCase()}`]);
      setCopied(true);
      
      // Resetar após 3s (tempo da barra de progresso)
      setTimeout(() => {
        setCopied(false);
        setLastAction(null);
        setCopiedSlots([]);
        setPeriodFilterName("");
      }, 3000);
      
      setRecordToCancel(null);
    }
  };

  const slots = useMemo(() => {
    if (deferredSearchTerm) {
      return filteredRecords.filter((r: Appointment) =>
        r.client.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        r.service.toLowerCase().includes(deferredSearchTerm.toLowerCase())
      );
    }
    const dayStartMin = 7 * 60 + 20;
    const dayEndMin = 20 * 60 + 40;
    const slotDuration = 40;
    const result: Appointment[] = [];
    const unhandledRecords = [...filteredRecords];
    let currentMin = dayStartMin;

    while (currentMin <= dayEndMin) {
      if (currentMin >= 12 * 60 && currentMin < 13 * 60) { currentMin = 13 * 60; continue; }

      const windowEnd = currentMin + slotDuration;
      let consumed = false;

      // Consume ALL records that fall within this slot's window
      while (unhandledRecords.length > 0) {
        const [h, m] = unhandledRecords[0].time.split(":").map(Number);
        const nextMin = h * 60 + m;
        if (nextMin < windowEnd) {
          result.push(unhandledRecords.shift()!);
          consumed = true;
        } else {
          break;
        }
      }

      // Only emit empty placeholder if no real record filled this window
      if (!consumed) {
        const h = Math.floor(currentMin / 60); const m = currentMin % 60;
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        result.push({ id: `empty-${timeStr}`, time: timeStr, date: selectedDateStr, client: "---", service: "A DEFINIR", value: 0, paymentMethod: "PIX", isEmpty: true, barberId: selectedBarberId ? Number(selectedBarberId) : undefined });
      }

      currentMin += slotDuration;
    }

    // Records outside the schedule window
    unhandledRecords.forEach(r => result.push(r));
    const final = result.sort((a, b) => a.time.localeCompare(b.time));

    return showEmptySlots ? final : final.filter(r => !r.isEmpty);
  }, [filteredRecords, deferredSearchTerm, showEmptySlots, selectedDateStr, selectedBarberId]);

  const handleDayChange = useCallback((delta: number) => setCurrentDate(prev => delta > 0 ? addDays(prev, delta) : subDays(prev, Math.abs(delta))), []);

  // Arrow keys day-by-day navigation
  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.hasAttribute("contenteditable"))
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        handleDayChange(-1);
      } else if (e.key === "ArrowRight") {
        handleDayChange(1);
      }
    };

    window.addEventListener("keydown", handleArrowKeys);
    return () => window.removeEventListener("keydown", handleArrowKeys);
  }, [handleDayChange]);
  const handleDaySelect = useCallback((day: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setDate(day); return d; }); }, []);
  const handleMonthSelect = useCallback((month: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setMonth(month - 1); return d; }); }, []);
  const handleYearSelect = useCallback((year: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setFullYear(year); return d; }); }, []);

  const handleSync = async () => { 
    setIsSyncing(true); 
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["records"] }),
      queryClient.invalidateQueries({ queryKey: ["clients"] }),
      queryClient.invalidateQueries({ queryKey: ["procedures"] })
    ]);
    await new Promise(r => setTimeout(r, 800)); 
    setIsSyncing(false); 
  };

  const handleCopySchedule = useCallback((period: string = "todos") => {
    // Filtramos para manter APENAS os horários vazios/disponíveis
    let filtered = slots.filter(s => (s.isEmpty || s.client === "---") && !s.service?.includes("FECHADO") && s.client !== "PAUSA");
    
    if (period === "manha") {
      filtered = filtered.filter(s => parseInt(s.time.split(":")[0]) < 12);
    } else if (period === "tarde") {
      filtered = filtered.filter(s => {
        const h = parseInt(s.time.split(":")[0]);
        const m = parseInt(s.time.split(":")[1]);
        const totalMinutes = h * 60 + m;
        return totalMinutes >= 13 * 60 && totalMinutes <= (20 * 60 + 20);
      });
    }

    if (filtered.length === 0) return;

    const dateFormatted = format(currentDate, "dd/MM/yyyy", { locale: ptBR });
    const periodName = period === "manha" ? "Manhã" : period === "tarde" ? "Tarde" : "Todos";
    let text = `📅 *AGENDA — ${dateFormatted}*\n\n`;
    
    const times: string[] = [];
    filtered.forEach(s => {
      const timeStr = s.time.substring(0, 5);
      times.push(timeStr);
    });

    text += times.join(" ; ");

    navigator.clipboard.writeText(text);
    setPeriodFilterName(periodName);
    setCopiedSlots(times);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setCopiedSlots([]);
      setPeriodFilterName("");
    }, 2500);
  }, [slots, currentDate]);

  const openAddModal = useCallback((time: string, date?: string, barberId?: number, clientName?: string) => {
    const lucas = barbers.find((b: any) => b.nome?.toLowerCase() === "lucas");
    const defaultBarberId = barberId || selectedBarberId || (lucas ? lucas.id : (barbers[0]?.id || null));
    setEditingRecord({ 
      time, 
      date: date || selectedDateStr, 
      client: clientName || "", 
      service: "", 
      value: 0, 
      paymentMethod: "PIX", 
      observations: "",
      barberId: defaultBarberId ? Number(defaultBarberId) : undefined
    }); 
    setIsModalOpen(true); 
  }, [selectedDateStr, selectedBarberId, barbers]);
  const openEditModal = useCallback((record: Appointment) => { setEditingRecord(record); setIsModalOpen(true); }, []);
  const handleSaveModal = useCallback(async (formData: Partial<Appointment>) => {
    if (!formData) return;
    
    const proceedSave = (shouldRegister: boolean) => {
      const finalData = { ...formData };
      
      const saveAppt = () => {
        updateMutation.mutate({ 
          id: finalData.id || `empty-${finalData.time}`, 
          updates: finalData, 
          dateStr: selectedDateStr,
          barberId: finalData.barberId
        });

        // Notificação de Sucesso
        const timeLabel = (finalData.time || "00:00").substring(0, 5);
        setPeriodFilterName("Agendado com Sucesso");
        setCopiedSlots([`${timeLabel} — ${finalData.client?.toUpperCase() || "CLIENTE"}`]);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          setCopiedSlots([]);
          setPeriodFilterName("");
        }, 2800);

        setIsModalOpen(false);
        setEditingRecord(null);
        setPendingRegistration(null);
      };

      if (shouldRegister && finalData.client) {
        registerClientMutation.mutate(finalData.client, {
          onSuccess: () => {
            saveAppt();
          }
        });
      } else {
        saveAppt();
      }
    };

    const cleanClientName = formData.client?.trimEnd();
    if (cleanClientName && cleanClientName !== "---" && cleanClientName.toUpperCase() !== "PAUSA") {
      const exists = clients?.some((c: any) => c.nome?.toLowerCase() === cleanClientName.toLowerCase());
      if (!exists) {
        setPendingRegistration({
          clientName: cleanClientName,
          onConfirm: () => proceedSave(true),
          onCancelAction: () => proceedSave(false)
        });
        return;
      }
    }

    proceedSave(false);
  }, [updateMutation, selectedDateStr, clients]);

  const freeSlots = useMemo(() => slots.filter(s => s.isEmpty), [slots]);
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const dayOptions = daysInMonth.map((d: Date) => ({ value: d.getDate(), label: `${format(d, 'EEE', { locale: ptBR }).toUpperCase().slice(0, 3)} ${format(d, 'dd')}` }));
  const monthOptions = [ { value: 1, label: "JAN" }, { value: 2, label: "FEV" }, { value: 3, label: "MAR" }, { value: 4, label: "ABR" }, { value: 5, label: "MAI" }, { value: 6, label: "JUN" }, { value: 7, label: "JUL" }, { value: 8, label: "AGO" }, { value: 9, label: "SET" }, { value: 10, label: "OUT" }, { value: 11, label: "NOV" }, { value: 12, label: "DEZ" } ];
  const yearOptions = useMemo(() => {
    const startYear = 2024;
    const endYear = new Date().getFullYear() + 2;
    const options = [];
    for (let y = startYear; y <= endYear; y++) {
      options.push({ value: y, label: `'${String(y).slice(-2)}` });
    }
    return options;
  }, []);
  const periodOptions = [
    { value: "manha", label: "Manhã", icon: Sun },
    { value: "tarde", label: "Tarde", icon: CloudSun },
    { value: "todos", label: "Todos", icon: List }
  ];

  return (
    <div className="px-4 py-8 md:px-8 pb-32 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-7xl mx-auto min-h-screen">
      {/* Header and Search/Controls Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Title & Date Selectors */}
        <div className="flex flex-wrap items-center gap-4 shrink-0">
          <div className="hidden md:block">
            <h2 className="text-text-primary text-3xl font-black tracking-tight uppercase italic leading-none">Agenda</h2>
            <p className="text-text-secondary text-[8px] font-black uppercase tracking-widest mt-1">Sincronização Ativa</p>
          </div>

          <div className="flex items-center gap-1 flex-nowrap">
            <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0">
              <button onClick={() => handleDayChange(-1)} className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronLeft size={12} className="md:size-[14px]" /></button>
              <PremiumSelector value={currentDate.getDate()} options={dayOptions} onSelect={handleDaySelect} className="bg-transparent !px-1 md:!px-2 !py-1 md:!py-1.5 w-[70px] md:w-[85px] text-[10px] md:text-[11px]" />
              <button onClick={() => handleDayChange(1)} className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronRight size={12} className="md:size-[14px]" /></button>
            </div>
            <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0"><PremiumSelector value={currentDate.getMonth() + 1} options={monthOptions} onSelect={handleMonthSelect} className="bg-transparent !px-1.5 md:!px-3 !py-1 md:!py-1.5 min-w-[55px] md:min-w-[70px] text-[10px] md:text-[11px]" /></div>
            <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0"><PremiumSelector value={currentDate.getFullYear()} options={yearOptions} onSelect={handleYearSelect} className="bg-transparent !px-1.5 md:!px-3 !py-1 md:!py-1.5 min-w-[45px] md:min-w-[55px] text-[10px] md:text-[11px]" /></div>
            
            <button 
              onClick={handleSync} 
              className={cn(
                "w-7 h-7 md:w-9 md:h-9 rounded-xl md:rounded-2xl bg-surface-section hover:bg-surface-subtle transition-all flex items-center justify-center border-none shrink-0 ml-0.5", 
                isSyncing && "animate-spin"
              )}
            >
              <RefreshCw size={12} className="md:size-[14px] text-text-primary" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Eye, Copy, Barber Tabs, Add */}
        <div className="flex flex-wrap items-center gap-3 flex-1 xl:justify-end">
          {/* Search Box & Controls Group */}
          <div className="flex flex-nowrap gap-2 items-center bg-surface-section/30 p-2 rounded-2xl border-none shadow-2xl flex-1 max-w-xl">
            {/* Search Input */}
            <div className="flex-1 min-w-[80px] md:min-w-[150px] relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-primary transition-colors z-10" size={14} />
              <input 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                placeholder="Pesquisar..." 
                className="w-full bg-surface-page/50 border-none pl-9 pr-3 h-9 rounded-xl outline-none focus:bg-surface-page/80 transition-all font-bold text-[10px] uppercase text-white shadow-inner" 
              />
            </div>

            {/* Toggle Empty Slots */}
            <button 
              onClick={() => setShowEmptySlots(!showEmptySlots)} 
              className={cn(
                "p-1.5 rounded-lg transition-all border-none cursor-pointer", 
                showEmptySlots ? "bg-brand-primary text-surface-page" : "text-text-muted hover:text-white"
              )}
              title={showEmptySlots ? "Ocultar Horários Vazios" : "Mostrar Horários Vazios"}
            >
              {showEmptySlots ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>

            {/* Copy Schedule */}
            <div className="relative flex items-center">
              <button 
                onClick={() => setShowCopyMenu(!showCopyMenu)} 
                className={cn(
                   "p-1.5 rounded-lg border-none transition-all cursor-pointer",
                   (copied || showCopyMenu) ? "bg-brand-primary text-surface-page" : "text-text-muted hover:text-white"
                )}
                title="Copiar Agenda"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>

              {showCopyMenu && (
                <div 
                  ref={copyMenuRef}
                  className="absolute right-0 top-full mt-2 bg-surface-section border border-white/5 rounded-2xl p-2 shadow-2xl z-[120] flex flex-row gap-1 min-w-max animate-in fade-in zoom-in-95 duration-200"
                >
                  {periodOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setShowCopyMenu(false);
                        handleCopySchedule(opt.value);
                      }}
                      className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-text-secondary hover:bg-white/5 hover:text-white transition-all border-none cursor-pointer"
                    >
                      <opt.icon size={16} className="text-text-muted" />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Barber Selection Tabs inline */}
          {barbers.length > 0 && (
            <div className="flex bg-surface-section/30 p-1 rounded-[1.25rem] w-fit gap-1 border-none shadow-inner shrink-0">
              {barbers.map((barber) => (
                <button
                  key={barber.id}
                  onClick={() => setSelectedBarberId(barber.id)}
                  className={cn(
                    "w-9 h-9 flex items-center justify-center text-[10px] font-black uppercase rounded-xl transition-all border-none cursor-pointer",
                    selectedBarberId === barber.id
                      ? "bg-brand-primary text-surface-page shadow-md"
                      : "text-text-secondary hover:text-white hover:bg-white/5"
                  )}
                  title={barber.nome}
                >
                  {barber.nome ? barber.nome.split(' ').map((n: any) => n[0]).join('').toUpperCase() : ''}
                </button>
              ))}
            </div>
          )}

          {/* Plus Add button next to search/tabs */}
          <button 
            onClick={() => openAddModal("08:00")} 
            className="w-10 h-10 bg-brand-primary text-surface-page rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-primary/10 border-none shrink-0 cursor-pointer"
            title="Novo Agendamento"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Alerta de Cópia - FIXED BOTTOM */}
      <AnimatePresence>
        {copied && (
          <motion.div 
            initial={{ opacity: 0, y: 100, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 100, x: "-50%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200, ease: "easeInOut" }}
            className="fixed bottom-28 md:bottom-12 left-1/2 bg-surface-section border border-white/5 rounded-[1.5rem] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.9)] z-[999] min-w-[280px] max-w-[90vw] overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black relative shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                  <Check size={20} strokeWidth={4} />
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Sucesso</span>
                <h4 className="text-lg font-black text-white leading-tight">{periodFilterName}</h4>
              </div>

            </div>
            <div className="mt-4 bg-[#0c0c0e] rounded-[1rem] py-2.5 px-4 border border-white/5 shadow-inner">
               <p className="text-[9px] font-black text-white/70 tracking-[0.1em] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                {copiedSlots.join(" - ")}
               </p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="h-full bg-brand-primary"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4 md:space-y-0 md:bg-surface-section/30 md:rounded-[2rem] border-none overflow-visible mt-6 shadow-2xl shadow-black/20">
        <div className="hidden md:grid md:grid-cols-[85px_1.5fr_1.2fr_1fr_100px_140px_110px] gap-0 bg-white/[0.02] border-none px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest items-center rounded-t-[2rem]">
          <div className="px-4">Horário</div>
          <div className="px-4">Cliente</div>
          <div className="px-4">Procedimentos</div>
          <div className="px-4">Observações</div>
          <div className="px-4">Valor</div>
          <div className="px-4">Pagamento</div>
          <div className="text-right pr-8">Ações</div>
        </div>
        <div className="space-y-1 md:space-y-0 md:divide-y md:divide-white/[0.02] md:[&>*:last-child>div:first-child]:rounded-b-[2rem]">
          {isLoading ? ( 
            <div className="p-12 text-center text-text-muted animate-pulse uppercase text-[10px] font-black tracking-widest italic">Carregando agendamentos...</div> 
          ) : slots.length === 0 ? ( 
            <div className="p-12 text-center text-text-muted uppercase text-[10px] font-black tracking-widest italic">Nenhum registro encontrado</div> 
          ) : ( 
            slots.map((record) => ( 
              <RecordRow 
                key={record.id} 
                record={record} 
                onUpdate={handleUpdate} 
                onCancel={handleCancel} 
                onAdd={openAddModal} 
                onEdit={openEditModal}
                onSendWhatsApp={handleSendWhatsApp}
                clientSuggestions={clientSuggestions}
                serviceSuggestions={serviceSuggestions}
                clients={clients || []}
                procedures={procedures || []}
              /> 
            )) 
          )}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingRecord?.id ? "Editar Agendamento" : "Novo Agendamento"}
        subtitle={editingRecord?.id ? (editingRecord.client || "") : "Preencha os dados abaixo"}
        icon={editingRecord?.id ? <Edit size={20} /> : <CalendarPlus size={20} />}
        className="modal-compact"
      >
        {isModalOpen && editingRecord && (
          <AppointmentForm
            key={editingRecord.id || editingRecord.time}
            initial={editingRecord}
            clientSuggestions={clientSuggestions}
            serviceSuggestions={serviceSuggestions}
            freeSlots={freeSlots}
            currentDate={currentDate}
            clients={clients || []}
            procedures={procedures || []}
            barbers={barbers}
            onSave={handleSaveModal}
            onDateChange={setCurrentDate}
            onCopy={(label, times) => {
              setPeriodFilterName(label);
              setCopiedSlots(times);
              setCopied(true);
              setTimeout(() => {
                setCopied(false);
                setCopiedSlots([]);
                setPeriodFilterName("");
              }, 2500);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancelar Horário"
        icon={<Trash2 size={16} className="text-rose-500" />}
        className="modal-compact"
      >
        <div className="flex flex-col gap-4 py-1 text-center">
          <p className="text-[11px] font-bold text-text-secondary leading-normal">
            Deseja mesmo cancelar o horário de <span className="text-white font-black uppercase">{recordToCancel?.client}</span> às <span className="text-white font-black">{recordToCancel?.time.substring(0, 5)}</span>?
          </p>

          <div className="flex w-full gap-2">
            <button
              onClick={() => setIsCancelModalOpen(false)}
              className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              Voltar
            </button>
            <button
              onClick={confirmCancel}
              className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      {/* Auto Client Registration Confirm Modal */}
      <Modal
        isOpen={!!pendingRegistration}
        onClose={() => {
          if (pendingRegistration) pendingRegistration.onCancelAction();
        }}
        title="Cadastrar Novo Cliente?"
      >
        <div className="flex flex-col gap-4 py-1 text-center">
          <p className="text-[11px] font-bold text-text-secondary leading-normal">
            O cliente <span className="text-white font-black uppercase">"{pendingRegistration?.clientName}"</span> não está cadastrado.
            <br />
            Deseja cadastrá-lo automaticamente no sistema agora?
          </p>

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => {
                if (pendingRegistration) pendingRegistration.onConfirm();
              }}
              disabled={registerClientMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-brand-primary text-surface-page text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              {registerClientMutation.isPending ? "Cadastrando..." : "Sim, Cadastrar Cliente"}
            </button>
            
            <button
              onClick={() => {
                if (pendingRegistration) pendingRegistration.onCancelAction();
              }}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              Não, Apenas Agendar (Sem Cadastrar)
            </button>
          </div>
        </div>
      </Modal>

      <WaitlistPanel
        dateStr={selectedDateStr}
        clientSuggestions={clientSuggestions}
        onAddAppointment={(clientName, timePref) => {
          openAddModal(timePref || "08:00", selectedDateStr, undefined, clientName);
        }}
      />
    </div>
  );
}
