"use client";

import { useClients, useProcedures } from "@/hooks/use-data";
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
  List,
  ExternalLink,
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
}

// --- Components ---

const RecordRow = memo(function RecordRowComponent({ 
  record, 
  onUpdate, 
  onCancel, 
  onAdd,
  onEdit,
  clientSuggestions,
  serviceSuggestions,
  clients,
}: { 
  record: Appointment; 
  onUpdate: (id: string, updates: Partial<Appointment>) => void; 
  onCancel: (record: Appointment) => void;
  onAdd: (time: string, date: string) => void;
  onEdit: (record: Appointment) => void;
  clientSuggestions: Suggestion<string>[];
  serviceSuggestions: Suggestion<string>[];
  clients: any[];
}) {
  const isEmpty = record.isEmpty;
  const isBreak = record.client === "PAUSA";

  const handleClientSave = async (clientName: string) => {
    const updates: Partial<Appointment> = { client: clientName || "---" };
    const match = clients.find(
      (c) => c.nome?.toLowerCase() === clientName?.toLowerCase()
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

      // 2. Count UNIQUE DAYS of usage since that dynamic start
      let qUsage = supabase
        .from("agendamentos")
        .select("data")
        .ilike("cliente", match.nome)
        .neq("cliente", "PAUSA"); 
      
      if (startDate) {
        qUsage = qUsage.gte("data", startDate);
      }
      // Count only unique days STRICTLY BEFORE the date being scheduled
      qUsage = qUsage.lt("data", today);
      
      const { data: usageData } = await qUsage;
      const uniqueDays = new Set(usageData?.map(u => u.data)).size;
      const usedSoFar = uniqueDays;
      const limite = match.limite_cortes || 0;
      
      const nextDay = usedSoFar + 1;
      const isRenew = isRenewalDay || (limite > 0 && usedSoFar >= limite) || nextDay === 1;
      updates.service = isRenew ? "RENOVAÇÃO 1 DIA" : `${nextDay} DIA`;
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
        "hidden md:grid md:grid-cols-[80px_1.5fr_1.2fr_1fr_100px_130px_100px] md:gap-4 items-center px-6 py-3 transition-colors group relative border-none focus-within:z-[500] z-[1]",
        isBreak ? "bg-surface-subtle" : "hover:bg-white/[0.02]"
      )}>
        <div className="text-xs font-bold text-text-primary/80">
          <input 
            type="time" 
            defaultValue={record.time.substring(0, 5)}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== record.time.substring(0, 5)) {
                onUpdate(record.id, { time: e.target.value });
              }
            }}
            className="bg-surface-section border-none outline-none focus:ring-1 focus:ring-brand-primary rounded px-1.5 py-0.5 w-auto text-xs font-bold text-text-primary/80 transition-all"
          />
        </div>

        <div className="relative min-w-0">
          <InlineAutocomplete
            value={isEmpty ? "" : (isBreak ? "PAUSA" : record.client)}
            placeholder={isEmpty ? "---" : "Cliente..."}
            suggestions={isBreak ? [] : clientSuggestions}
            onSave={handleClientSave}
            className={cn(
              "text-sm font-bold uppercase",
              isBreak ? "text-text-muted" : isEmpty ? "text-text-muted/40 italic font-medium" : "text-text-primary"
            )}
          />
          {!isEmpty && !isBreak && (() => {
            const clientObj = clients.find(
              (c) => c.nome?.toLowerCase() === record.client?.toLowerCase()
            );
            if (!clientObj) return null;
            return (
              <Link
                href={`/clientes/${clientObj.id}`}
                className="absolute -right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-brand-primary/50 hover:text-brand-primary transition-all"
                title={`Ver perfil de ${record.client}`}
              >
                <ExternalLink size={10} />
              </Link>
            );
          })()}
        </div>

        <div className="relative min-w-0">
          <InlineAutocomplete
            value={isEmpty ? "" : (isBreak ? "RESERVADO" : record.service)}
            placeholder={isEmpty ? "A DEFINIR" : "Serviço..."}
            suggestions={isBreak ? [] : serviceSuggestions}
            onSave={(val) => onUpdate(record.id, { service: val || "A DEFINIR" })}
            className={cn(
              "text-sm uppercase font-medium",
              isBreak ? "text-text-muted italic" : isEmpty ? "text-text-muted/40" : record.service === "A DEFINIR" ? "text-rose-500 font-black animate-pulse" : "text-text-primary"
            )}
          />
        </div>

        <div className="text-xs text-text-secondary italic min-w-0">
           <InlineInput 
            value={isEmpty || isBreak ? "" : (record.observations || "")} 
            placeholder={isEmpty || isBreak ? "---" : "Nenhuma obs..."}
            onSave={(val) => onUpdate(record.id, { observations: val })}
            className="truncate"
          />
        </div>

        <div className={cn("text-sm font-bold", isBreak ? "text-text-muted/50" : "text-brand-primary/90")}>
          <InlineInput 
            type="number"
            prefix={isEmpty || isBreak ? undefined : "R$"}
            value={isEmpty || isBreak ? "" : record.value} 
            placeholder={isEmpty || isBreak ? "---" : "0.00"}
            onSave={(val) => onUpdate(record.id, { value: parseFloat(val) || 0 })}
          />
        </div>

        <div className="relative">
          {isBreak ? (
            <span className="text-[10px] font-black text-text-muted uppercase">N/A</span>
          ) : (
            <div className={cn("relative", isEmpty && "opacity-0 group-hover:opacity-100")}>
              <PaymentSelector
                value={record.paymentMethod || ""}
                onChange={(val) => onUpdate(record.id, { paymentMethod: val })}
                isCompact
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {!isEmpty ? (
            <>
              <button 
                onClick={() => onEdit(record)}
                className="w-8 h-8 rounded-xl bg-white/5 text-text-secondary hover:bg-brand-primary hover:text-surface-page transition-all flex items-center justify-center border-none"
              >
                <Edit size={14} />
              </button>
              <button 
                onClick={() => onCancel(record)}
                className="w-8 h-8 rounded-xl bg-white/5 text-rose-500/50 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border-none"
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : (
            <button 
              onClick={() => onAdd(record.time, record.date)}
              className="w-full py-1.5 rounded-lg bg-brand-primary text-surface-page text-[10px] font-black uppercase transition-all border-none"
            >
              Agendar
            </button>
          )}
        </div>
      </div>

      <div className="md:hidden grid grid-cols-[70px_1fr_80px] gap-4 items-center px-6 py-4 bg-surface-section/40 rounded-2xl mx-1 my-1 border-none focus-within:z-[100] z-[1]">
        <div className="text-[13px] text-text-primary font-bold">
          {record.time.substring(0, 5)}
        </div>
        <div className={cn("text-[13px] font-black truncate uppercase", isEmpty ? "text-text-muted" : "text-white")}>
          {isBreak ? "PAUSA" : record.client}
        </div>
        <div className="flex justify-end items-center gap-2">
          {!isEmpty ? (
            <div className="flex gap-2">
               <button onClick={() => onEdit(record)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-subtle text-text-secondary active:scale-90 border-none">
                 <Edit size={18} />
               </button>
               <button onClick={() => onCancel(record)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-subtle text-text-secondary active:scale-90 border-none">
                 <Trash2 size={18} />
               </button>
            </div>
          ) : (
            <button 
              onClick={() => onAdd(record.time, record.date)}
              className="px-4 py-2 rounded-lg bg-text-primary text-surface-page text-[10px] font-black uppercase active:scale-95 border-none"
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
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [periodFilter, setPeriodFilter] = useState("todos");
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);

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

  // O ouvinte do Jarvis foi movido para depois das Mutations para evitar problemas de escopo.

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
      return (data || []).map((r: any) => ({
        id: String(r.id), 
        date: r.data, 
        time: r.horario, 
        client: r.cliente,
        service: r.procedimento || "A DEFINIR", 
        observations: r.observacoes,
        value: r.valor, 
        paymentMethod: r.forma_pagamento
      }) as Appointment);
    }
  });

  const clientSuggestions: Suggestion<string>[] = useMemo(() => 
    clients?.map(c => ({ id: c.id, label: c.nome, value: c.nome })) || [], [clients]
  );
  
  const serviceSuggestions: Suggestion<string>[] = useMemo(() => 
    procedures?.map(p => ({ 
      id: p.id, label: p.nome, value: p.nome, 
      subLabel: p.valor ? `R$ ${p.valor.toFixed(2)}` : undefined 
    })) || [], [procedures]
  );

  const updateMutation = useMutation({
    mutationFn: async ({ id: rawId, updates, dateStr }: { id: string, updates: Partial<Appointment>, dateStr: string }) => {
      const id = String(rawId);
      const dbUpdates: any = {};
      if (updates.client !== undefined) dbUpdates.cliente = updates.client;
      if (updates.service !== undefined) dbUpdates.procedimento = updates.service;
      if (updates.value !== undefined) dbUpdates.valor = updates.value;
      if (updates.observations !== undefined) dbUpdates.observacoes = updates.observations;
      if (updates.paymentMethod !== undefined) dbUpdates.forma_pagamento = updates.paymentMethod;
      if (updates.time !== undefined) dbUpdates.horario = updates.time;

      if (id.startsWith('empty-')) {
        const { error } = await supabase.from('agendamentos').insert({
          cliente: updates.client || "---",
          procedimento: updates.service || "A DEFINIR",
          valor: updates.value || 0,
          forma_pagamento: updates.paymentMethod || "PIX",
          observacoes: updates.observations || "",
          data: dateStr,
          horario: updates.time || id.replace('empty-', '')
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('agendamentos').update(dbUpdates).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      console.log('[AGENDA] updateMutation onSuccess, refetching:', variables.dateStr);
      queryClient.refetchQueries({ queryKey: ["records", variables.dateStr] });
    },
    onError: (error) => {
      console.error('[AGENDA] updateMutation ERRO:', error);
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id: rawId }: { id: string }) => {
      const id = String(rawId);
      const { error } = await supabase.from('agendamentos').delete().eq('id', id);
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

  // Jarvis Integration (Agora abaixo das Mutations para ter acesso sem erros)
  useEffect(() => {
    const handleJarvis = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail) return;
      
      const { type, payload } = customEvent.detail;
      if (type === "AGENDA_OPEN") {
        const { clientName, time, date } = payload;
        
        if (date !== format(currentDate, "yyyy-MM-dd")) {
          setCurrentDate(parse(date, "yyyy-MM-dd", new Date()));
        }

        const formData = {
          time,
          date,
          client: clientName || "",
          service: "A DEFINIR",
          paymentMethod: "A DEFINIR",
          value: 0,
          observations: "Agendado via IA"
        };

        // Se a IA encontrou pelo menos um cliente válido e um horário válido, salva direto no banco!
        if (clientName && time) {
           updateMutation.mutate({
             id: `empty-${time}`,
             updates: formData,
             dateStr: date
           });

           // Dá a notificação de SUCESSO na tela de forma silenciosa e legal
           setPeriodFilterName("Assistente IA");
           setCopiedSlots([`${time} — ${clientName.toUpperCase()}`]);
           setCopied(true);
           setTimeout(() => {
             setCopied(false);
             setCopiedSlots([]);
             setPeriodFilterName("");
           }, 3000);
        } else {
           // Se faltou dado crasso, joga pro modal pra ele olhar com os olhos humanos
           setEditingRecord(formData);
           setIsModalOpen(true);
        }
      }
    };

    window.addEventListener("jarvis-action", handleJarvis);
    return () => window.removeEventListener("jarvis-action", handleJarvis);
  }, [currentDate, setCurrentDate, updateMutation]);

  const handleUpdate = useCallback((id: string, updates: Partial<Appointment>) => {
    updateMutation.mutate({ id, updates, dateStr: selectedDateStr });
  }, [updateMutation, selectedDateStr]);

  const handleCancel = useCallback((record: Appointment) => {
    setRecordToCancel(record);
    setIsCancelModalOpen(true);
  }, []);

  const confirmCancel = () => {
    if (recordToCancel) {
      cancelMutation.mutate({ id: recordToCancel.id });
      setIsCancelModalOpen(false);
      setRecordToCancel(null);

      // Notificação de Sucesso (Compacta)
      setPeriodFilterName("Cancelado com Sucesso");
      setCopiedSlots([`${recordToCancel.time.substring(0, 5)} — ${recordToCancel.client.toUpperCase()}`]);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setCopiedSlots([]);
        setPeriodFilterName("");
      }, 2500);
    }
  };

  const slots = useMemo(() => {
    if (deferredSearchTerm) {
      return records.filter((r: Appointment) =>
        r.client.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        r.service.toLowerCase().includes(deferredSearchTerm.toLowerCase())
      );
    }
    const dayStartMin = 7 * 60 + 20;
    const dayEndMin = 20 * 60 + 40;
    const slotDuration = 40;
    const result: Appointment[] = [];
    const unhandledRecords = [...records];
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
        result.push({ id: `empty-${timeStr}`, time: timeStr, date: selectedDateStr, client: "---", service: "A DEFINIR", value: 0, paymentMethod: "PIX", isEmpty: true });
      }

      currentMin += slotDuration;
    }

    // Records outside the schedule window
    unhandledRecords.forEach(r => result.push(r));
    const final = result.sort((a, b) => a.time.localeCompare(b.time));

    return showEmptySlots ? final : final.filter(r => !r.isEmpty);
  }, [records, deferredSearchTerm, showEmptySlots, selectedDateStr]);

  const handleDayChange = useCallback((delta: number) => setCurrentDate(prev => delta > 0 ? addDays(prev, delta) : subDays(prev, Math.abs(delta))), []);
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
    let text = `📅 *AGENDA — ${dateFormatted} (${periodName.toUpperCase()})*\n\n`;
    
    const times: string[] = [];
    filtered.forEach(s => {
      const timeStr = s.time.substring(0, 5);
      const isVacant = s.isEmpty || s.client === "---";
      const clientName = isVacant ? "DISPONÍVEL" : s.client.toUpperCase();
      const serviceName = isVacant ? "" : ` (${s.service.toUpperCase()})`;
      
      text += `• ${timeStr} - ${clientName}${serviceName}\n`;
      times.push(timeStr);
    });

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

  const openAddModal = useCallback((time: string) => { setEditingRecord({ time, date: selectedDateStr, client: "", service: "", value: 0, paymentMethod: "PIX", observations: "" }); setIsModalOpen(true); }, [selectedDateStr]);
  const openEditModal = useCallback((record: Appointment) => { setEditingRecord(record); setIsModalOpen(true); }, []);
  const handleSaveModal = useCallback(async (formData: Partial<Appointment>) => {
    if (!formData) return;
    updateMutation.mutate({ 
      id: formData.id || `empty-${formData.time}`, 
      updates: formData, 
      dateStr: selectedDateStr 
    });

    // Notificação de Sucesso
    const timeLabel = (formData.time || "00:00").substring(0, 5);
    setPeriodFilterName("Agendado com Sucesso");
    setCopiedSlots([`${timeLabel} — ${formData.client?.toUpperCase() || "CLIENTE"}`]);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setCopiedSlots([]);
      setPeriodFilterName("");
    }, 2800);

    setIsModalOpen(false);
    setEditingRecord(null);
  }, [updateMutation, selectedDateStr]);

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
      <div className="flex flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0">
            <button onClick={() => handleDayChange(-1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronLeft size={14} /></button>
            <PremiumSelector value={currentDate.getDate()} options={dayOptions} onSelect={handleDaySelect} className="bg-transparent !px-2 !py-1.5 w-[85px]" />
            <button onClick={() => handleDayChange(1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronRight size={14} /></button>
          </div>
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0"><PremiumSelector value={currentDate.getMonth() + 1} options={monthOptions} onSelect={handleMonthSelect} className="bg-transparent !px-3 !py-1.5 min-w-[70px]" /></div>
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0"><PremiumSelector value={currentDate.getFullYear()} options={yearOptions} onSelect={handleYearSelect} className="bg-transparent !px-3 !py-1.5 min-w-[55px]" /></div>
          
          <button 
            onClick={handleSync} 
            className={cn(
              "w-9 h-9 rounded-2xl bg-surface-section hover:bg-surface-subtle transition-all flex items-center justify-center border-none shrink-0 ml-0.5", 
              isSyncing && "animate-spin"
            )}
          >
            <RefreshCw size={14} className="text-text-primary" />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <h1 className="text-sm font-black text-brand-primary italic tracking-tighter opacity-80 uppercase font-display">LUCAS DO CORTE</h1>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mt-8">
        <div><h2 className="text-text-primary text-3xl font-bold">Agenda</h2><p className="text-text-secondary text-sm mt-1">Sincronização Ativa</p></div>
        <div className="relative flex flex-row gap-2 items-center w-full md:w-auto">
          <button onClick={() => openAddModal("08:00")} className="flex items-center justify-center w-12 h-12 md:w-10 md:h-10 rounded-full bg-brand-primary text-surface-page hover:scale-110 transition-all shadow-lg shadow-brand-primary/50 shrink-0 border-none"><Plus size={20} /></button>
          
          <div className="relative flex items-center">
            {/* Botão de Trigger / Cópia principal */}
            <button 
              onClick={() => setShowCopyMenu(!showCopyMenu)} 
              className={cn(
                 "flex items-center justify-center w-12 h-12 md:w-10 md:h-10 rounded-xl border-none bg-surface-section/50 transition-all shrink-0 hover:text-brand-primary",
                 (copied || showCopyMenu) ? "text-brand-primary" : "text-text-secondary"
              )}
              title="Copiar Agenda"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>

            {/* Menu Dropdown de Período */}
            {showCopyMenu && (
              <div 
                ref={copyMenuRef}
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-surface-section border border-white/5 rounded-2xl p-2 shadow-2xl z-[120] flex flex-row gap-1 min-w-max animate-in fade-in zoom-in-95 duration-200"
              >
                {periodOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setShowCopyMenu(false);
                      handleCopySchedule(opt.value);
                    }}
                    className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-text-secondary hover:bg-white/5 hover:text-white transition-all border-none"
                  >
                    <opt.icon size={16} className="text-text-muted" />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Alerta de Cópia - FIXED BOTTOM (Igual ao Mockup) */}
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
                  {/* Left Icon with Glow */}
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black relative shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                      <Check size={20} strokeWidth={4} />
                    </div>
                  </div>

                  {/* Header Text */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Sucesso</span>
                    <h4 className="text-lg font-black text-white leading-tight">{periodFilterName}</h4>
                  </div>
                </div>

                {/* Hours horizontal list (The Pill) */}
                <div className="mt-4 bg-[#0c0c0e] rounded-[1rem] py-2.5 px-4 border border-white/5 shadow-inner">
                   <p className="text-[9px] font-black text-white/70 tracking-[0.1em] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                    {copiedSlots.join(" - ")}
                   </p>
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          <button onClick={() => setShowEmptySlots(!showEmptySlots)} className={cn("flex items-center justify-center w-12 h-12 md:w-10 md:h-10 rounded-xl border-none bg-surface-section/50 transition-all shrink-0", showEmptySlots ? "text-brand-primary" : "text-text-secondary")}>{showEmptySlots ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          <div className="relative group flex items-center">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-primary transition-colors z-10" size={16} />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Pesquisar..." className="bg-surface-section/50 border-none rounded-2xl pl-12 pr-4 py-3 md:py-2 text-sm text-text-primary outline-none focus:ring-1 focus:ring-brand-primary/30 w-full md:w-[220px] font-medium transition-all" />
          </div>
      </div>
      </div>

      <div className="space-y-4 md:space-y-0 md:bg-surface-section/30 md:rounded-[2rem] border-none overflow-visible mt-6 shadow-2xl shadow-black/20">
        <div className="hidden md:grid md:grid-cols-[80px_1.5fr_1.2fr_1fr_100px_130px_100px] gap-4 bg-white/[0.02] border-none px-6 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest items-center rounded-t-[2rem]">
          <div>Horário</div><div>Cliente</div><div>Procedimentos</div><div>Observações</div><div>Valor</div><div>Pagamento</div><div className="text-right pr-4">Ações</div>
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
                clientSuggestions={clientSuggestions}
                serviceSuggestions={serviceSuggestions}
                clients={clients || []}
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
        subtitle="Confirma o cancelamento?"
        icon={<Trash2 size={18} className="text-rose-500" />}
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="bg-rose-500/5 p-5 rounded-[1.2rem] border border-rose-500/10 text-center">
            <h4 className="text-lg font-black text-white uppercase italic">
              {recordToCancel?.time.substring(0, 5)} — {recordToCancel?.client.toUpperCase()}
            </h4>
            <p className="text-[10px] font-bold text-text-muted mt-2 leading-tight">
              Esta ação é permanente. Deseja prosseguir?
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsCancelModalOpen(false)}
              className="flex-1 bg-surface-section text-white font-black py-3 rounded-xl border-none uppercase tracking-widest text-[10px] hover:bg-surface-subtle transition-all"
            >
              Manter
            </button>
            <button
              onClick={confirmCancel}
              className="flex-1 bg-rose-500 text-white font-black py-3 rounded-xl border-none uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/10 hover:brightness-110 transition-all active:scale-[0.98]"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
