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
  ExternalLink, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  CalendarPlus,
  Edit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useState, useMemo, useCallback, memo, useDeferredValue } from "react";
import { 
  format, 
  addDays, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { PremiumSelector } from "@/components/shared/premium-selector";
import { InlineInput } from "@/components/shared/inline-input";
import { InlineAutocomplete } from "@/components/shared/inline-autocomplete";
import { Modal } from "@/components/shared/modal";
import { type Suggestion } from "@/components/shared/autocomplete-input";
import Link from "next/link";
import { AppointmentForm } from "./AppointmentForm";

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
  onCancel: (id: string) => void;
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

      const startDate = latestRenov?.[0]?.data || renewDate;

      // 2. Count usage since that dynamic start
      let qUsage = supabase
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .ilike("cliente", match.nome)
        .or(`procedimento.ilike.%dia%,procedimento.ilike.%renova%`);
      
      if (startDate) {
        qUsage = qUsage.gte("data", startDate);
      }
      
      const { count } = await qUsage;
      const usedSoFar = count ?? 0;
      const limite = match.limite_cortes || 0;
      const dayInCycle = limite > 0 ? usedSoFar % limite : usedSoFar;
      const isRenew = isRenewalDay || dayInCycle === 0;
      updates.service = isRenew ? "RENOVAÇÃO 1° DIA" : `${dayInCycle + 1}° DIA`;
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
        "hidden md:grid md:grid-cols-[80px_1.5fr_1.2fr_1fr_100px_130px_100px] md:gap-4 items-center px-6 py-3 transition-colors group relative border-none focus-within:z-[100] z-[1]",
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
               <select 
                 value={record.paymentMethod || ""}
                 onChange={(e) => onUpdate(record.id, { paymentMethod: e.target.value })}
                 className="w-full appearance-none px-2 py-0.5 rounded text-[10px] font-black border-none bg-surface-subtle text-text-secondary uppercase cursor-pointer focus:bg-brand-primary/10 transition-all pr-4 outline-none"
               >
                 {["PIX", "DINHEIRO", "CARTÃO", "PLANO MENSAL", "PLANO SEMESTRAL", "PLANO ANUAL", "CORTESIA"].map(p => (
                   <option key={p} value={p} className="bg-[#1c1c1f]">{p}</option>
                 ))}
               </select>
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
                onClick={() => onCancel(record.id)}
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
               <button onClick={() => onCancel(record.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-subtle text-text-secondary active:scale-90 border-none">
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [showEmptySlots, setShowEmptySlots] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Partial<Appointment> | null>(null);

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

  const handleUpdate = useCallback((id: string, updates: Partial<Appointment>) => {
    updateMutation.mutate({ id, updates, dateStr: selectedDateStr });
  }, [updateMutation, selectedDateStr]);

  const handleCancel = useCallback((id: string) => {
    cancelMutation.mutate({ id });
  }, [cancelMutation]);

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

  const openAddModal = useCallback((time: string) => { setEditingRecord({ time, date: selectedDateStr, client: "", service: "", value: 0, paymentMethod: "PIX", observations: "" }); setIsModalOpen(true); }, [selectedDateStr]);
  const openEditModal = useCallback((record: Appointment) => { setEditingRecord(record); setIsModalOpen(true); }, []);
  const handleSaveModal = useCallback(async (formData: Partial<Appointment>) => {
    if (!formData) return;
    updateMutation.mutate({ 
      id: formData.id || `empty-${formData.time}`, 
      updates: formData, 
      dateStr: selectedDateStr 
    });
    setIsModalOpen(false);
    setEditingRecord(null);
  }, [updateMutation, selectedDateStr]);

  const freeSlots = useMemo(() => slots.filter(s => s.isEmpty), [slots]);
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const dayOptions = daysInMonth.map((d: Date) => ({ value: d.getDate(), label: `${format(d, 'EEE', { locale: ptBR }).toUpperCase().slice(0, 3)} ${format(d, 'dd')}` }));
  const monthOptions = [ { value: 1, label: "JAN" }, { value: 2, label: "FEV" }, { value: 3, label: "MAR" }, { value: 4, label: "ABR" }, { value: 5, label: "MAI" }, { value: 6, label: "JUN" }, { value: 7, label: "JUL" }, { value: 8, label: "AGO" }, { value: 9, label: "SET" }, { value: 10, label: "OUT" }, { value: 11, label: "NOV" }, { value: 12, label: "DEZ" } ];
  const yearOptions = [ { value: 2024, label: "'24" }, { value: 2025, label: "'25" }, { value: 2026, label: "'26" } ];

  return (
    <div className="px-4 py-8 md:px-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-32 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5">
            <button onClick={() => handleDayChange(-1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronLeft size={14} /></button>
            <PremiumSelector value={currentDate.getDate()} options={dayOptions} onSelect={handleDaySelect} className="bg-transparent !px-2 !py-1.5 w-[85px]" />
            <button onClick={() => handleDayChange(1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronRight size={14} /></button>
          </div>
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5"><PremiumSelector value={currentDate.getMonth() + 1} options={monthOptions} onSelect={handleMonthSelect} className="bg-transparent !px-3 !py-1.5 min-w-[70px]" /></div>
          <div className="hidden sm:flex items-center bg-surface-section rounded-2xl p-0.5"><PremiumSelector value={currentDate.getFullYear()} options={yearOptions} onSelect={handleYearSelect} className="bg-transparent !px-3 !py-1.5 min-w-[60px]" /></div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <h1 className="hidden md:block text-sm font-black text-brand-primary italic tracking-tighter opacity-80 uppercase font-display">LUCAS DO CORTE</h1>
          <button onClick={handleSync} className={cn("w-9 h-9 rounded-2xl bg-surface-section hover:bg-surface-subtle transition-all flex items-center justify-center border-none", isSyncing && "animate-spin")}><RefreshCw size={14} className="text-text-primary" /></button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mt-8">
        <div><h2 className="text-text-primary text-3xl font-bold">Agenda</h2><p className="text-text-secondary text-sm mt-1">Sincronização Ativa</p></div>
        <div className="relative flex flex-row gap-2 items-center w-full md:w-auto">
          <button onClick={() => openAddModal("08:00")} className="flex items-center justify-center w-12 h-12 md:w-10 md:h-10 rounded-full bg-brand-primary text-surface-page hover:scale-110 transition-all shadow-lg shadow-brand-primary/50 shrink-0 border-none"><Plus size={20} /></button>
          <button onClick={() => setShowEmptySlots(!showEmptySlots)} className={cn("flex items-center justify-center w-12 h-12 md:w-10 md:h-10 rounded-xl border-none bg-surface-section/50 transition-all shrink-0", showEmptySlots ? "text-brand-primary" : "text-text-secondary")}>{showEmptySlots ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          <div className="relative flex-1 md:w-80"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} /><input type="text" placeholder="Buscar agendamento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-surface-section border-none h-12 md:h-10 pl-11 pr-4 rounded-xl text-sm text-text-primary outline-none focus:ring-1 focus:ring-brand-primary w-full" /></div>
        </div>
      </div>

      <div className="space-y-4 md:space-y-0 md:bg-surface-section/30 md:rounded-[2rem] border-none overflow-hidden mt-6">
        <div className="hidden md:grid md:grid-cols-[80px_1.5fr_1.2fr_1fr_100px_130px_100px] gap-4 bg-white/[0.02] border-none px-6 py-5 text-[10px] font-black text-text-secondary uppercase tracking-widest items-center">
          <div>Horário</div><div>Cliente</div><div>Procedimentos</div><div>Observações</div><div>Valor</div><div>Pagamento</div><div className="text-right pr-4">Ações</div>
        </div>
        <div className="space-y-1 md:space-y-0 md:divide-y md:divide-white/[0.02]">
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
          />
        )}
      </Modal>
    </div>
  );
}
