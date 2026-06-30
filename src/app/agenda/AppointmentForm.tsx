"use client";

import { useState, useCallback, memo, useRef, useEffect, useMemo } from "react";
import { Search, Calendar, Clock, Coffee, Copy, Sun, Sunset, Moon, List, ChevronDown, Scissors } from "lucide-react";
import { format } from "date-fns";
import { AutocompleteInput, type Suggestion } from "@/components/shared/autocomplete-input";
import { cn } from "@/lib/utils";
import { PaymentSelector } from "@/components/shared/payment-selector";
import { supabase } from "@/lib/supabase";
import { DayPicker } from "react-day-picker";
import { TimeField, DateInput, DateSegment } from "react-aria-components";
import { Time } from "@internationalized/date";

interface AppointmentRecord {
  id?: string;
  date?: string;
  time?: string;
  client?: string;
  service?: string;
  observations?: string;
  value?: number;
  paymentMethod?: string;
  barberId?: number;
}

interface FreeSlot { time: string; }

interface AppointmentFormProps {
  initial: AppointmentRecord;
  clientSuggestions: Suggestion<string>[];
  serviceSuggestions: Suggestion<string>[];
  freeSlots: FreeSlot[];
  currentDate: Date;
  clients: any[];
  procedures: any[];
  barbers: any[];
  onSave: (record: AppointmentRecord) => void;
  onCopy?: (label: string, times: string[]) => void;
  onDateChange?: (date: Date) => void;
}


export const AppointmentForm = memo(function AppointmentForm({
  initial,
  clientSuggestions,
  serviceSuggestions,
  freeSlots,
  currentDate,
  clients,
  procedures,
  barbers,
  onSave,
  onCopy,
  onDateChange,
}: AppointmentFormProps) {
  const [form, setForm] = useState<AppointmentRecord>(initial);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [calendarDate, setCalendarDate] = useState(() => {
    if (initial.date) {
      const [y, m, d] = initial.date.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const timePickerRef = useRef<HTMLDivElement>(null);

  // Sync state if form date changes from outside (e.g. autofill or suggestions)
  useEffect(() => {
    if (form.date) {
      const [y, m, d] = form.date.split("-").map(Number);
      setCalendarDate(new Date(y, m - 1, d));
    }
  }, [form.date]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPeriodPicker(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setShowTimePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hoursList = useMemo(() => {
    const list = [];
    for (let h = 7; h <= 22; h++) {
      const padH = String(h).padStart(2, "0");
      list.push(`${padH}:00`);
      list.push(`${padH}:30`);
    }
    return list;
  }, []);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [calendarDate]);

  const set = useCallback(<K extends keyof AppointmentRecord>(key: K, value: AppointmentRecord[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSetBreak = useCallback(() => {
    setForm(prev => ({
      ...prev,
      client: "PAUSA",
      service: "RESERVADO",
      value: 0,
      paymentMethod: "CORTESIA",
      observations: "Horário reservado/pausa",
    }));
  }, []);

  const handleSelectService = useCallback((item: Suggestion<string>) => {
    setForm(prev => {
      const updates: Partial<AppointmentRecord> = { service: item.value };
      const match = procedures.find(p => p.nome?.toLowerCase().trim() === item.value?.toLowerCase().trim());
      if (match) {
        updates.value = match.preco ?? match.valor ?? 0;
      } else if (item.subLabel) {
        const raw = item.subLabel.replace("R$ ", "").replace(/\./g, "").replace(",", ".");
        const price = parseFloat(raw);
        if (!isNaN(price)) updates.value = price;
      }
      return { ...prev, ...updates };
    });
  }, [procedures]);

  const handleSelectClient = useCallback(async (item: Suggestion<string>) => {
    const clientObj = clients.find(
      (c: any) => c.nome?.toLowerCase() === item.value?.toLowerCase()
    );
    console.log('[AUTO-FILL] item:', item.value, '| clients count:', clients.length, '| found:', clientObj?.nome, '| plano:', clientObj?.plano);
    if (clientObj?.plano && clientObj.plano !== "Nenhum" && clientObj.plano !== "Pausado") {
      const today = format(currentDate, "yyyy-MM-dd");
      const renewDate = clientObj.plano_pagamento;
      const isRenewalDay = renewDate === today;

      // 1. Find the latest "RENOVAÇÃO" appointment date for this client
      const { data: latestRenov } = await supabase
        .from("agendamentos")
        .select("data")
        .ilike("cliente", clientObj.nome)
        .ilike("procedimento", "%renova%")
        .order("data", { ascending: false })
        .limit(1);

      const dbRenovDate = latestRenov?.[0]?.data;
      const manualResetDate = clientObj.plano_pagamento;

      // The cycle starts at the LATEST of the last physical renovation or the manual reset date
      let startDate = dbRenovDate;
      if (!startDate || (manualResetDate && manualResetDate > startDate)) {
        startDate = manualResetDate;
      }

      // 2. Query usage count since that start date (Count UNIQUE DAYS)
      let qUsage = supabase
        .from("agendamentos")
        .select("data")
        .ilike("cliente", clientObj.nome)
        .neq("cliente", "PAUSA"); 
      
      if (startDate) {
        qUsage = qUsage.gte("data", startDate);
      }
      // Count unique days STRICTLY BEFORE the date being scheduled
      qUsage = qUsage.lt("data", today);
      
      const { data: usageData } = await qUsage;
      const uniqueDays = new Set(usageData?.map(u => u.data)).size;
      const usedSoFar = uniqueDays;
      const limite = clientObj.limite_cortes || 0;

      const nextDay = usedSoFar + 1;
      const isRenew = isRenewalDay || (limite > 0 && usedSoFar >= limite) || nextDay === 1;
      const dayLabel = isRenew ? "RENOVAÇÃO 1º DIA" : `${nextDay}º DIA`;
      
      setForm(prev => ({
        ...prev,
        client: item.value,
        paymentMethod: isRenew ? "PIX" : "PLANO",
        service: dayLabel,
        ...(isRenew && clientObj.valor_plano ? { value: clientObj.valor_plano } : {}),
      }));
    } else {
      setForm(prev => {
        const updates: Partial<AppointmentRecord> = { client: item.value };
        if (clientObj?.preset) {
          if (clientObj.preset.service) updates.service = clientObj.preset.service;
          if (clientObj.preset.value) updates.value = parseFloat(clientObj.preset.value) || 0;
          if (clientObj.preset.payment) updates.paymentMethod = clientObj.preset.payment;
        }
        return { ...prev, ...updates };
      });
    }
  }, [clients, currentDate]);

  const handleCopySlots = useCallback((period: "manha" | "tarde" | "tudo") => {
    const ranges: Record<string, [number, number]> = {
      manha: [7 * 60, 12 * 60 - 1],
      tarde: [13 * 60, 20 * 60 + 20],
      tudo:  [0, 24 * 60],
    };
    const [start, end] = ranges[period];
    const filtered = freeSlots.filter(s => {
      const [h, m] = s.time.split(":").map(Number);
      const min = h * 60 + m;
      return min >= start && min <= end;
    });

    const label = { manha: "Manhã", tarde: "Tarde", tudo: "Todos" }[period];
    const dateFormatted = format(currentDate, "dd/MM/yyyy");
    
    let text = `📅 *AGENDA — ${dateFormatted}*\n\n`;
    const times: string[] = [];

    filtered.forEach(s => {
      const timeStr = s.time.substring(0, 5);
      times.push(timeStr);
    });

    text += times.join(" ; ");
    
    navigator.clipboard.writeText(text);
    
    setShowPeriodPicker(false);
    if (onCopy) onCopy(label, times);
  }, [freeSlots, currentDate, onCopy]);

  return (
    <div className="flex flex-col gap-3 py-2 w-full">
      {/* Cliente */}
      <div className="figma-form-group">
        <div className="figma-form-label-row">
          <label className="figma-form-label">Cliente</label>
          <button
            type="button"
            onClick={handleSetBreak}
            className="text-[10px] font-bold uppercase tracking-wider text-brand-primary hover:text-white transition-all flex items-center gap-1 border-none bg-transparent h-auto p-0 cursor-pointer"
          >
            <Coffee size={12} /> Pausa
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex-1 min-w-0">
            <AutocompleteInput
              value={form.client || ""}
              onChange={val => set("client", val)}
              onSelect={handleSelectClient}
              suggestions={clientSuggestions}
              placeholder="Digite o nome do cliente..."
              inputClassName="uppercase font-bold figma-form-input"
            />
          </div>
          {barbers.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const currentIdx = barbers.findIndex(b => Number(b.id) === Number(form.barberId));
                const nextIdx = (currentIdx + 1) % barbers.length;
                const nextBarber = barbers[nextIdx];
                set("barberId", Number(nextBarber.id));
              }}
              className="px-3 h-[45px] shrink-0 rounded-2xl bg-surface-subtle hover:bg-white/5 border-none text-[10px] font-black uppercase text-brand-primary cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              title="Alternar Barbeiro"
            >
              <Scissors size={12} />
              <span>{barbers.find(b => Number(b.id) === Number(form.barberId))?.nome?.split(' ')[0] || "Sem Barbeiro"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Data + Horário */}
      <div className="grid grid-cols-2 gap-3">
        <div className="figma-form-group relative" ref={datePickerRef}>
          <label className="figma-form-label">Data</label>
          <button
            type="button"
            onClick={() => setShowDatePicker(p => !p)}
            className="figma-form-input text-left font-bold flex items-center justify-between cursor-pointer"
          >
            <span>{form.date ? format(new Date(form.date + "T12:00:00"), "dd/MM/yyyy") : "Selecionar Data"}</span>
            <Calendar size={14} className="text-text-secondary" />
          </button>
          {showDatePicker && (
            <div className="absolute left-0 top-full mt-2 z-[2000] bg-[#121214] border border-white/[0.05] rounded-3xl shadow-2xl p-3 figma-datepicker-popover">
              <DayPicker
                mode="single"
                selected={form.date ? new Date(form.date + "T12:00:00") : undefined}
                onSelect={(d) => {
                  if (d) {
                    const formatted = format(d, "yyyy-MM-dd");
                    set("date", formatted);
                    if (onDateChange) onDateChange(d);
                    setShowDatePicker(false);
                  }
                }}
              />
            </div>
          )}
        </div>

        <div className="figma-form-group relative" ref={timePickerRef}>
          <label className="figma-form-label">Horário</label>
          <button
            type="button"
            onClick={() => setShowTimePicker(p => !p)}
            className="figma-form-input text-left font-bold flex items-center justify-between cursor-pointer"
          >
            <span>{form.time || "Selecionar Horário"}</span>
            <Clock size={14} className="text-text-secondary" />
          </button>
          {showTimePicker && (
            <div className="absolute right-0 top-full mt-2 z-[2000] bg-[#121214] border border-white/[0.05] rounded-3xl shadow-2xl p-3 w-[180px] flex gap-2 h-[180px]">
              {/* Hour Wheel */}
              <div className="flex-1 overflow-y-auto custom-scroll flex flex-col gap-1 text-center pr-1 snap-y snap-mandatory">
                <div className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 border-b border-white/5 pb-1">H</div>
                {Array.from({ length: 16 }, (_, i) => String(i + 7).padStart(2, "0")).map(h => {
                  const currentHour = form.time ? form.time.split(":")[0] : "08";
                  const isSelected = currentHour === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        const m = form.time ? form.time.split(":")[1] : "00";
                        set("time", `${h}:${m}`);
                      }}
                      className={cn(
                        "w-full py-1 rounded-xl text-[11px] font-bold border-none cursor-pointer transition-all snap-center",
                        isSelected 
                          ? "bg-brand-primary text-surface-page font-black" 
                          : "text-text-secondary hover:bg-white/5"
                      )}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
              
              {/* Minutes Wheel */}
              <div className="flex-1 overflow-y-auto custom-scroll flex flex-col gap-1 text-center pr-1 snap-y snap-mandatory">
                <div className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1 border-b border-white/5 pb-1">M</div>
                {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map(m => {
                  const currentMin = form.time ? form.time.split(":")[1] : "00";
                  const isSelected = currentMin === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const h = form.time ? form.time.split(":")[0] : "08";
                        set("time", `${h}:${m}`);
                      }}
                      className={cn(
                        "w-full py-1 rounded-xl text-[11px] font-bold border-none cursor-pointer transition-all snap-center",
                        isSelected 
                          ? "bg-brand-primary text-surface-page font-black" 
                          : "text-text-secondary hover:bg-white/5"
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Horários livres */}
      {freeSlots.length > 0 && (
        <div className="figma-form-group">
          <div className="figma-form-label-row">
            <label className="figma-form-label">
              Sugestões de Horário Livre
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowPeriodPicker(p => !p)}
                className="text-[10px] font-bold uppercase tracking-wider text-brand-primary hover:text-white transition-all flex items-center gap-1 border-none bg-transparent h-auto p-0 cursor-pointer"
              >
                <Copy size={12} /> Copiar Lista <ChevronDown size={10} className={`transition-transform ${showPeriodPicker ? "rotate-180" : ""}`} />
              </button>
            {showPeriodPicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-[#121214] border border-white/[0.05] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden min-w-[140px]">
                {([
                  { key: "manha", label: "Manhã",  icon: <Sun size={12} /> },
                  { key: "tarde", label: "Tarde",  icon: <Sunset size={12} /> },
                  { key: "tudo",  label: "Todos",   icon: <List size={12} /> },
                ] as const).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleCopySlots(key)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-black text-text-secondary hover:bg-surface-subtle hover:text-white transition-all border-none text-left cursor-pointer"
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5 custom-scroll scrollbar-none snap-x">
            {freeSlots.map(s => {
              const isSelected = form.time === s.time;
              return (
                <button
                  key={s.time}
                  type="button"
                  onClick={() => set("time", s.time)}
                  className={cn("figma-free-slot border-none shrink-0 snap-start", isSelected && "figma-free-slot-active")}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Serviço */}
      <div className="figma-form-group">
        <label className="figma-form-label">Serviço</label>
        <AutocompleteInput
          value={form.service || ""}
          onChange={val => set("service", val)}
          onSelect={handleSelectService}
          suggestions={serviceSuggestions}
          placeholder="Digite o serviço..."
          inputClassName="uppercase font-bold figma-form-input"
        />
      </div>

      {/* Valor + Pagamento */}
      <div className="grid grid-cols-2 gap-3">
        <div className="figma-form-group">
          <label className="figma-form-label">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={form.value ?? 0}
            onChange={e => set("value", parseFloat(e.target.value) || 0)}
            className="figma-form-input font-bold"
            placeholder="0.00"
          />
        </div>
        <div className="figma-form-group">
          <label className="figma-form-label">Pagamento</label>
          <PaymentSelector
            value={form.paymentMethod || ""}
            onChange={val => set("paymentMethod", val)}
          />
        </div>
      </div>

      {/* Observações */}
      <div className="figma-form-group">
        <label className="figma-form-label">Observações</label>
        <textarea
          placeholder="Informações adicionais..."
          value={form.observations || ""}
          onChange={e => set("observations", e.target.value)}
          className="figma-form-textarea font-medium !h-16 py-2.5"
        />
      </div>

      {/* Salvar */}
      <button
        type="button"
        onClick={() => onSave({ ...form, service: form.service?.trim() || "A DEFINIR" })}
        className="w-full py-3 mt-2 rounded-2xl bg-brand-primary text-surface-page text-[11px] font-black uppercase tracking-widest border-none hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-brand-primary/10"
      >
        Salvar Agendamento
      </button>
    </div>
  );
});
