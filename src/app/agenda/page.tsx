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
  barberId?: number;
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
  procedures,
}: { 
  record: Appointment; 
  onUpdate: (id: string, updates: Partial<Appointment>) => void; 
  onCancel: (record: Appointment) => void;
  onAdd: (time: string, date: string, barberId?: number) => void;
  onEdit: (record: Appointment) => void;
  clientSuggestions: Suggestion<string>[];
  serviceSuggestions: Suggestion<string>[];
  clients: any[];
  procedures: any[];
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
            onSave={(val, item) => {
              const updates: Partial<Appointment> = { service: val || "A DEFINIR" };
              // 1. Try finding by name in procedures list
              const match = procedures.find(p => p.nome?.toLowerCase().trim() === val?.toLowerCase().trim());
              if (match) {
                updates.value = match.preco ?? match.valor ?? 0;
              } 
              // 2. Fallback: Parse from subLabel if item is available
              else if (item?.subLabel) {
                 const raw = item.subLabel.replace("R$ ", "").replace(/\./g, "").replace(",", ".");
                 const price = parseFloat(raw);
                 if (!isNaN(price)) updates.value = price;
              }
              onUpdate(record.id, updates);
            }}
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
              onClick={() => onAdd(record.time, record.date, record.barberId ? Number(record.barberId) : undefined)}
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
              onClick={() => onAdd(record.time, record.date, record.barberId ? Number(record.barberId) : undefined)}
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
          barberId: barberId
        } as Appointment;
      });
    }
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
      if (updates.client !== undefined) dbUpdates.cliente = updates.client;
      if (updates.service !== undefined) dbUpdates.procedimento = updates.service;
      if (updates.value !== undefined) dbUpdates.valor = updates.value;
      if (updates.observations !== undefined) dbUpdates.observacoes = updates.observations;
      if (updates.paymentMethod !== undefined) dbUpdates.forma_pagamento = updates.paymentMethod;
      if (updates.time !== undefined) dbUpdates.horario = updates.time;
      if (updates.date !== undefined) dbUpdates.data = updates.date;

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
        const { data, error } = await supabase.from(tableName).insert({
          cliente: updates.client || "---",
          procedimento: updates.service || "A DEFINIR",
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
    updateMutation.mutate({ id, updates, dateStr: selectedDateStr, barberId });
  }, [updateMutation, selectedDateStr]);

  const handleCancel = useCallback((record: Appointment) => {
    setRecordToCancel(record);
    setIsCancelModalOpen(true);
  }, []);

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

  const openAddModal = useCallback((time: string, date?: string, barberId?: number) => {
    const lucas = barbers.find((b: any) => b.nome?.toLowerCase() === "lucas");
    const defaultBarberId = barberId || selectedBarberId || (lucas ? lucas.id : (barbers[0]?.id || null));
    setEditingRecord({ 
      time, 
      date: date || selectedDateStr, 
      client: "", 
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
    updateMutation.mutate({ 
      id: formData.id || `empty-${formData.time}`, 
      updates: formData, 
      dateStr: selectedDateStr,
      barberId: formData.barberId
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
      {/* Header and Search/Controls Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Title & Date Selectors */}
        <div className="flex flex-wrap items-center gap-4 shrink-0">
          <div>
            <h2 className="text-text-primary text-3xl font-black tracking-tight uppercase italic leading-none">Agenda</h2>
            <p className="text-text-secondary text-[8px] font-black uppercase tracking-widest mt-1">Sincronização Ativa</p>
          </div>

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
        </div>

        {/* Toolbar: Search, Eye, Copy, Barber Tabs, Add */}
        <div className="flex flex-wrap items-center gap-3 flex-1 xl:justify-end">
          {/* Search Box & Controls Group */}
          <div className="flex flex-wrap gap-2 items-center bg-surface-section/30 p-2 rounded-2xl border-none shadow-2xl flex-1 max-w-xl">
            {/* Search Input */}
            <div className="flex-1 min-w-[150px] relative group">
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
    </div>
  );
}
