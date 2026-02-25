"use client";

import { useState, useCallback, memo, useRef, useEffect } from "react";
import { Search, Calendar, Clock, Coffee, Copy, Sun, Sunset, Moon, List, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { AutocompleteInput, type Suggestion } from "@/components/shared/autocomplete-input";
import { supabase } from "@/lib/supabase";

interface AppointmentRecord {
  id?: string;
  date?: string;
  time?: string;
  client?: string;
  service?: string;
  observations?: string;
  value?: number;
  paymentMethod?: string;
}

interface FreeSlot { time: string; }

interface AppointmentFormProps {
  initial: AppointmentRecord;
  clientSuggestions: Suggestion<string>[];
  serviceSuggestions: Suggestion<string>[];
  freeSlots: FreeSlot[];
  currentDate: Date;
  clients: any[];
  onSave: (record: AppointmentRecord) => void;
}

const PAYMENT_OPTIONS = ["PIX", "DINHEIRO", "CARTÃO", "PLANO", "CORTESIA"];

export const AppointmentForm = memo(function AppointmentForm({
  initial,
  clientSuggestions,
  serviceSuggestions,
  freeSlots,
  currentDate,
  clients,
  onSave,
}: AppointmentFormProps) {
  const [form, setForm] = useState<AppointmentRecord>(initial);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPeriodPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPeriodPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPeriodPicker]);

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
      if (item.subLabel) {
        const price = parseFloat(item.subLabel.replace("R$ ", "").replace(",", "."));
        if (!isNaN(price)) updates.value = price;
      }
      return { ...prev, ...updates };
    });
  }, []);

  const handleSelectClient = useCallback(async (item: Suggestion<string>) => {
    const clientObj = clients.find(
      (c: any) => c.nome?.toLowerCase() === item.value?.toLowerCase()
    );
    console.log('[AUTO-FILL] item:', item.value, '| clients count:', clients.length, '| found:', clientObj?.nome, '| plano:', clientObj?.plano);
    if (clientObj?.plano && clientObj.plano !== "Nenhum" && clientObj.plano !== "Pausado") {
      const today = format(currentDate, "yyyy-MM-dd");
      const renewDate = clientObj.plano_pagamento;
      const isRenewalDay = renewDate === today;

      let dayLabel: string;
      if (isRenewalDay) {
        dayLabel = "RENOVAÇÃO 1° DIA";
      } else {
        // Query real count in cycle — exclude 'renova' from qPlan to avoid double counting
        // 1. Find the latest "RENOVAÇÃO" appointment date for this client
        const { data: latestRenov } = await supabase
          .from("agendamentos")
          .select("data")
          .ilike("cliente", clientObj.nome)
          .ilike("procedimento", "%renova%")
          .order("data", { ascending: false })
          .limit(1);

        const startDate = latestRenov?.[0]?.data || renewDate;

        // 2. Query usage count since that start date
        let qUsage = supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .ilike("cliente", clientObj.nome)
          .or(`procedimento.ilike.%dia%,procedimento.ilike.%renova%`);
        
        if (startDate) {
          qUsage = qUsage.gte("data", startDate);
        }
        
        const { count } = await qUsage;
        const usedSoFar = count ?? 0;
        // Cycle reset: when usedSoFar fills the limit, next is a new renewal
        const limite = clientObj.limite_cortes || 0;
        const dayInCycle = limite > 0 ? usedSoFar % limite : usedSoFar;
        dayLabel = dayInCycle === 0 ? "RENOVAÇÃO 1° DIA" : `${dayInCycle + 1}° DIA`;
      }

      const isRenew = dayLabel === "RENOVAÇÃO 1° DIA";
      setForm(prev => ({
        ...prev,
        client: item.value,
        paymentMethod: isRenew ? "PIX" : "PLANO",
        service: dayLabel,
        ...(isRenew && clientObj.valor_plano ? { value: clientObj.valor_plano } : {}),
      }));
    } else {
      setForm(prev => ({ ...prev, client: item.value }));
    }
  }, [clients, currentDate]);

  const handleCopySlots = useCallback((period: "manha" | "tarde" | "noite" | "tudo") => {
    const ranges: Record<string, [number, number]> = {
      manha: [7 * 60, 12 * 60 - 1],
      tarde: [12 * 60, 18 * 60 - 1],
      noite: [18 * 60, 21 * 60],
      tudo:  [0, 24 * 60],
    };
    const [start, end] = ranges[period];
    const filtered = freeSlots.filter(s => {
      const [h, m] = s.time.split(":").map(Number);
      const min = h * 60 + m;
      return min >= start && min <= end;
    });
    const label = { manha: "Manhã", tarde: "Tarde", noite: "Noite", tudo: "Tudo" }[period];
    navigator.clipboard.writeText(
      `Horários disponíveis (${label}) para ${format(currentDate, "dd/MM")}: ${filtered.map(s => s.time).join(", ")}`
    );
    setShowPeriodPicker(false);
  }, [freeSlots, currentDate]);

  return (
    <div className="space-y-5 py-4">
      {/* Cliente */}
      <div className="space-y-1">
        <div className="flex justify-between items-center mb-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Cliente</label>
          <button
            type="button"
            onClick={handleSetBreak}
            className="text-[10px] font-black uppercase tracking-widest text-brand-primary hover:text-white transition-all flex items-center gap-1.5 border-none bg-transparent h-auto p-0"
          >
            <Coffee size={12} /> Marcar como Pausa
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted z-10" size={16} />
          <AutocompleteInput
            value={form.client || ""}
            onChange={val => set("client", val)}
            onSelect={handleSelectClient}
            suggestions={clientSuggestions}
            placeholder="Digite o nome do cliente..."
            className="pl-0"
            inputClassName="uppercase font-bold pl-12 bg-surface-subtle"
          />
        </div>
      </div>

      {/* Data + Horário */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Data</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={16} />
            <input
              type="date"
              value={form.date || ""}
              onChange={e => set("date", e.target.value)}
              className="w-full bg-surface-subtle border-none rounded-2xl pl-11 pr-4 py-3 text-sm text-text-primary outline-none focus:ring-1 focus:ring-brand-primary font-bold"
              style={{ colorScheme: "dark" }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Horário</label>
          <div className="relative">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={16} />
            <input
              type="time"
              value={form.time || ""}
              onChange={e => set("time", e.target.value)}
              className="w-full bg-surface-subtle border-none rounded-2xl pl-11 pr-4 py-3 text-sm text-text-primary outline-none focus:ring-1 focus:ring-brand-primary font-bold"
            />
          </div>
        </div>
      </div>

      {/* Horários livres */}
      {freeSlots.length > 0 && (
        <div className="space-y-2">
          {/* Label + Dropdown */}
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">
              Sugestões de Horário Livre
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowPeriodPicker(p => !p)}
                className="text-[10px] font-black uppercase tracking-widest text-brand-primary hover:text-white transition-all flex items-center gap-1 border-none bg-transparent h-auto p-0"
              >
                <Copy size={12} /> Copiar Lista <ChevronDown size={10} className={`transition-transform ${showPeriodPicker ? "rotate-180" : ""}`} />
              </button>
            {showPeriodPicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-surface-section rounded-2xl shadow-2xl shadow-black/50 overflow-hidden min-w-[140px]">
                {([
                  { key: "manha", label: "Manhã",  icon: <Sun size={12} /> },
                  { key: "tarde", label: "Tarde",  icon: <Sunset size={12} /> },
                  { key: "noite", label: "Noite",  icon: <Moon size={12} /> },
                  { key: "tudo",  label: "Tudo",   icon: <List size={12} /> },
                ] as const).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleCopySlots(key)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-black text-text-secondary hover:bg-surface-subtle hover:text-white transition-all border-none text-left"
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {freeSlots.map(s => (
              <button
                key={s.time}
                type="button"
                onClick={() => set("time", s.time)}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-[10px] font-black text-text-secondary hover:bg-brand-primary hover:text-surface-page transition-all border-none"
              >
                {s.time}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Serviço */}
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Serviço</label>
        <AutocompleteInput
          value={form.service || ""}
          onChange={val => set("service", val)}
          onSelect={handleSelectService}
          suggestions={serviceSuggestions}
          placeholder="Digite o serviço..."
          inputClassName="uppercase font-bold bg-surface-subtle"
        />
      </div>

      {/* Valor */}
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Valor (R$)</label>
        <input
          type="number"
          step="0.01"
          value={form.value ?? 0}
          onChange={e => set("value", parseFloat(e.target.value) || 0)}
          className="w-full bg-surface-subtle border-none rounded-2xl px-4 py-3 text-sm text-text-primary outline-none focus:ring-1 focus:ring-brand-primary font-bold"
          placeholder="0.00"
        />
      </div>

      {/* Pagamento */}
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Pagamento</label>
        <select
          value={form.paymentMethod || ""}
          onChange={e => set("paymentMethod", e.target.value)}
          className="w-full bg-surface-subtle border-none rounded-2xl px-4 py-3 text-sm text-text-primary outline-none focus:ring-1 focus:ring-brand-primary appearance-none cursor-pointer font-bold"
        >
          <option value="" disabled>Selecione...</option>
          {PAYMENT_OPTIONS.map(p => (
            <option key={p} value={p} className="bg-surface-section">{p}</option>
          ))}
        </select>
      </div>

      {/* Observações */}
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-text-muted ml-1">Observações</label>
        <textarea
          placeholder="Informações adicionais..."
          value={form.observations || ""}
          onChange={e => set("observations", e.target.value)}
          className="w-full bg-surface-subtle border-none rounded-2xl px-4 py-3 text-sm text-text-primary outline-none focus:ring-1 focus:ring-brand-primary min-h-[80px] resize-none font-medium"
        />
      </div>

      {/* Salvar */}
      <button
        type="button"
        onClick={() => onSave({ ...form, service: form.service?.trim() || "A DEFINIR" })}
        className="w-full bg-brand-primary text-surface-page py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.01] active:scale-[0.98] transition-all shadow-xl shadow-brand-primary/10 border-none mt-4"
      >
        {form.id ? "Salvar Alterações" : "Salvar Agendamento"}
      </button>
    </div>
  );
});
