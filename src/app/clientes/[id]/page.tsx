"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useClients, useSupabase, useAppointments, useProcedures, useBarbers } from "@/hooks/use-data";
import { ChevronLeft, Crown, Wand2, Trash2, Calendar, TrendingUp, History, Info, RotateCcw, Plus, Clock, CreditCard, Edit3, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InlineInput } from "@/components/shared/inline-input";
import { InlineAutocomplete } from "@/components/shared/inline-autocomplete";
import { PaymentSelector } from "@/components/shared/payment-selector";
import { PremiumSelector } from "@/components/shared/premium-selector";
import { Modal } from "@/components/shared/modal";
import { DayPicker } from "react-day-picker";

export default function ClientProfilePage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: appointments = [], isLoading: loadingAppointments } = useAppointments();
  const { data: procedures = [] } = useProcedures();
  const { data: barbers = [] } = useBarbers();

  const client = useMemo(() => clients.find(c => String(c.id) === id), [clients, id]);

  const [showPreset, setShowPreset] = useState(false);
  const [dbUsage, setDbUsage] = useState(0);

  // Local preset state to prevent async saving delay issues
  const [localPreset, setLocalPreset] = useState<any>(null);

  useEffect(() => {
    if (client?.preset) {
      setLocalPreset(client.preset);
    } else {
      setLocalPreset({});
    }
  }, [client?.preset]);

  // States for automatic batch plan scheduling
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generatedAppointments, setGeneratedAppointments] = useState<{ date: string; time: string; barberId: number }[]>([]);
  const [firstDate, setFirstDate] = useState<string>("");
  const [showFirstDatePicker, setShowFirstDatePicker] = useState(false);
  const [activeDatePickerIdx, setActiveDatePickerIdx] = useState<number | null>(null);
  const [intervalDays, setIntervalDays] = useState<number>(7);
  const [batchCount, setBatchCount] = useState<number>(4);
  
  // Pending Name Migration State
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [pendingName, setPendingName] = useState("");



  const clientAppointments = useMemo(() => {
    if (!client) return [];
    return appointments
      .filter(a => a.client?.toLowerCase() === client.nome?.toLowerCase())
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || "00:00"}`);
        const dateB = new Date(`${b.date}T${b.time || "00:00"}`);
        return dateB.getTime() - dateA.getTime();
      });
  }, [appointments, client]);

  const stats = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    
    // Filter only records that already happened (up to today)
    const history = clientAppointments.filter(a => a.date <= todayStr);
    
    // Count UNIQUE DAYS for visits
    const uniqueDays = new Set(history.map(a => a.date)).size;
    
    const totalSpent = history.reduce((acc, a) => acc + (a.value || 0), 0);
    const lastVisit = history[0]?.date ? parseISO(history[0].date) : null;
    
    return {
      totalSpent,
      visitCount: uniqueDays,
      ticketMedio: uniqueDays ? totalSpent / uniqueDays : 0,
      lastVisit
    };
  }, [clientAppointments]);

  const planUsage = useMemo(() => {
    if (!client?.plano || client.plano === "Nenhum") return { used: 0, pct: 0, over: false };
    const used = dbUsage;
    const limit = client.limite_cortes || 0;
    const pct = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;
    return { used, pct, over: used >= limit && limit > 0 };
  }, [dbUsage, client]);

  const serviceSuggestions = useMemo(() => 
    procedures.map(p => ({ 
      id: String(p.id), label: p.nome, value: p.nome, 
      subLabel: p.valor ? `R$ ${p.valor.toFixed(2)}` : undefined 
    })), [procedures]);


  // Fetch real usage count from DB
  useEffect(() => {
    if (!client?.nome) return;
    const fetchUsage = async () => {
      // 1. Find the latest "RENOVAÇÃO" appointment date for this client
      const { data: latestRenov } = await supabase
        .from("agendamentos")
        .select("data")
        .ilike("cliente", client.nome)
        .ilike("procedimento", "%renova%")
        .order("data", { ascending: false })
        .limit(1);

      const dbRenovDate = latestRenov?.[0]?.data;
      const manualResetDate = client.plano_pagamento;

      // The cycle starts at the LATEST of the last physical renovation or the manual reset date
      let startDate = dbRenovDate;
      if (!startDate || (manualResetDate && manualResetDate > startDate)) {
        startDate = manualResetDate;
      }

      const todayStr = format(new Date(), "yyyy-MM-dd");

      // 2. Count UNIQUE DAYS of usage from that date forward (up to TODAY)
      let query = supabase
        .from("agendamentos")
        .select("data")
        .ilike("cliente", client.nome)
        .neq("cliente", "PAUSA")
        .lte("data", todayStr);

      if (startDate) {
        query = query.gte("data", startDate);
      }

      const { data: usageData } = await query;
      const uniqueDays = new Set(usageData?.map(u => u.data)).size;
      setDbUsage(uniqueDays);
    };
    fetchUsage();
  }, [client, supabase]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("clientes").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const updateClientAndMigrateHistoryMutation = useMutation({
    mutationFn: async ({ newName, migrate }: { newName: string, migrate: boolean }) => {
      const { error: clientError } = await supabase
        .from("clientes")
        .update({ nome: newName })
        .eq("id", id);
      if (clientError) throw clientError;

      if (migrate && client?.nome) {
        const oldName = client.nome;
        const { error: err1 } = await supabase
          .from("agendamentos_lucas")
          .update({ cliente: newName })
          .ilike("cliente", oldName);
        if (err1) throw err1;

        const { error: err2 } = await supabase
          .from("agendamentos_joao_lucas")
          .update({ cliente: newName })
          .ilike("cliente", oldName);
        if (err2) throw err2;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setIsNameModalOpen(false);
      setPendingName("");
    },
    onError: (err: any) => {
      console.error("Name update mutation error detail:", err.message || err.details || err);
      alert(`Erro ao atualizar o nome do cliente: ${err.message || JSON.stringify(err)}`);
    }
  });

  const handleStartNameUpdate = (v: string) => {
    if (!v.trim() || v.trim() === client?.nome) return;
    setPendingName(v.trim());
    setIsNameModalOpen(true);
  };

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id: apptId, updates, barberId }: { id: string, updates: any, barberId?: string | number | null }) => {
      const dbUpdates: any = {};
      if (updates.service !== undefined) dbUpdates.procedimento = updates.service;
      if (updates.value !== undefined) dbUpdates.valor = updates.value;
      if (updates.observations !== undefined) dbUpdates.observacoes = updates.observations;
      if (updates.paymentMethod !== undefined) dbUpdates.forma_pagamento = updates.paymentMethod;
      if (updates.time !== undefined) dbUpdates.horario = updates.time;

      const tableName = Number(barberId) === 3 ? "agendamentos_joao_lucas" : "agendamentos_lucas";
      const { error } = await supabase.from(tableName).update(dbUpdates).eq("id", apptId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async ({ apptId, barberId }: { apptId: string, barberId?: string | number | null }) => {
      const tableName = Number(barberId) === 3 ? "agendamentos_joao_lucas" : "agendamentos_lucas";
      const { error } = await supabase.from(tableName).delete().eq("id", apptId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const saveBatchMutation = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < generatedAppointments.length; i++) {
        const appt = generatedAppointments[i];
        const tableName = Number(appt.barberId) === 3 ? "agendamentos_joao_lucas" : "agendamentos_lucas";
        const matchedBarber = barbers.find((b: any) => Number(b.id) === Number(appt.barberId));
        const barberName = matchedBarber ? matchedBarber.nome : "";

        const { error } = await supabase.from(tableName).insert({
          cliente: client.nome,
          procedimento: `${i + 1}º DIA`,
          valor: parseFloat(client.preset?.value) || 0,
          forma_pagamento: client.preset?.payment || "PLANO",
          observacoes: "AGENDAMENTO AUTOMÁTICO DO PLANO",
          data: appt.date,
          horario: appt.time,
          barbeiro_id: appt.barberId,
          barbeiro: barberName
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setIsGenerateModalOpen(false);
      setGeneratedAppointments([]);
    }
  });

  const getNextFourDates = (dayOfWeekName: string): string[] => {
    const daysMap: { [key: string]: number } = {
      "domingo": 0, "segunda-feira": 1, "terça-feira": 2, "quarta-feira": 3,
      "quinta-feira": 4, "sexta-feira": 5, "sábado": 6
    };
    const targetDay = daysMap[dayOfWeekName.toLowerCase()];
    if (targetDay === undefined) return [];

    const dates: string[] = [];
    const currentDate = new Date();
    
    while (dates.length < 4) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (currentDate.getDay() === targetDay) {
        dates.push(format(currentDate, "yyyy-MM-dd"));
      }
    }
    return dates;
  };

  const cleanPhone = (phone: string): string => {
    if (!phone) return "";
    return phone.replace(/\D/g, "");
  };

  const formatTimeHHMM = (timeStr: string): string => {
    if (!timeStr) return "14:00";
    const clean = timeStr.trim();
    const parts = clean.split(":");
    if (parts.length < 2) return "14:00";
    const h = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    return `${h}:${m}`;
  };

  const regenerateList = (newFirstDate: string, currentInterval: number = intervalDays, currentCount: number = batchCount) => {
    const presetTime = localPreset?.time || "14:00";
    const presetBarberId = localPreset?.barberId ? Number(localPreset.barberId) : (barbers[0]?.id || 1);
    const formattedTime = formatTimeHHMM(presetTime);

    const list = Array.from({ length: currentCount }).map((_, idx) => {
      const date = new Date(newFirstDate + "T12:00:00");
      date.setDate(date.getDate() + (idx * currentInterval));
      return {
        date: format(date, "yyyy-MM-dd"),
        time: formattedTime,
        barberId: presetBarberId
      };
    });
    setGeneratedAppointments(list);
  };

  const getDatesRangeLabel = () => {
    if (generatedAppointments.length < 2) return "";
    try {
      const first = new Date(generatedAppointments[0].date + "T12:00:00");
      const last = new Date(generatedAppointments[generatedAppointments.length - 1].date + "T12:00:00");
      
      const diffTime = Math.abs(last.getTime() - first.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      const firstLabel = format(first, "dd/MM");
      const lastLabel = format(last, "dd/MM");
      
      return `"${diffDays} dias" ${firstLabel} - ${lastLabel}`;
    } catch (err) {
      return "";
    }
  };

  const handleGenerateBatch = () => {
    const presetDay = localPreset?.dayOfWeek;
    const rawTime = localPreset?.time || "14:00";
    const presetTime = formatTimeHHMM(rawTime);
    const presetBarberId = localPreset?.barberId ? Number(localPreset.barberId) : (barbers[0]?.id || 1);

    if (!presetDay) {
      alert("Por favor, configure o Dia da Semana Padrão no Preset primeiro.");
      return;
    }

    const nextDates = getNextFourDates(presetDay);
    if (nextDates.length === 0) return;

    // Reset settings to defaults
    setIntervalDays(7);
    setBatchCount(4);
    const initialFirstDate = nextDates[0];
    setFirstDate(initialFirstDate);

    // Initial list based on defaults
    const list = Array.from({ length: 4 }).map((_, idx) => {
      const date = new Date(initialFirstDate + "T12:00:00");
      date.setDate(date.getDate() + (idx * 7));
      return {
        date: format(date, "yyyy-MM-dd"),
        time: presetTime,
        barberId: presetBarberId
      };
    });

    setGeneratedAppointments(list);
    setIsGenerateModalOpen(true);
  };

  if (loadingClients || !client) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-[2rem] bg-surface-section flex items-center justify-center text-brand-primary text-4xl font-black shadow-2xl shrink-0">
          {client.nome?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 text-center sm:text-left space-y-1">
          <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3">
            <div className="min-w-[200px] sm:min-w-[300px]">
              <InlineInput
                value={client.nome}
                onSave={handleStartNameUpdate}
                className="text-3xl font-display font-black text-white bg-transparent p-0 uppercase tracking-tighter hover:text-brand-primary transition-colors h-auto w-full"
              />
            </div>
            {client.plano !== "Nenhum" && (
              <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black uppercase rounded border border-brand-primary/20">VIP</span>
            )}
          </div>
          <InlineInput
            value={client.observacoes_cliente || "Adicionar nota..."}
            onSave={(v) => updateMutation.mutate({ observacoes_cliente: v })}
            className="text-xs text-text-muted font-medium italic p-0 hover:text-white transition-all h-auto w-full md:w-max block"
          />
          <div className="flex items-center gap-2 text-xs font-bold text-text-secondary justify-center sm:justify-start pt-1">
            <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">Telefone:</span>
            <InlineInput
              value={client.telefone || "Adicionar telefone..."}
              onSave={(v) => updateMutation.mutate({ telefone: cleanPhone(v) })}
              className="p-0 text-white font-bold h-auto w-auto inline-block focus:bg-white/5"
            />
          </div>
          <div className="flex items-center gap-4 pt-4 justify-center sm:justify-start">
            <Link href="/clientes" className="text-[9px] font-black text-text-muted hover:text-white uppercase tracking-widest flex items-center gap-2 group">
              <ChevronLeft size={12} className="transition-transform group-hover:-translate-x-1" /> Voltar
            </Link>
            <span className="text-white/5">|</span>
            <button onClick={() => setShowPreset(!showPreset)} className="text-[9px] font-black text-brand-primary hover:text-white uppercase tracking-widest flex items-center gap-2">
              <Wand2 size={12} /> Preset Setup
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Faturamento", value: `R$ ${stats.totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: TrendingUp },
          { label: "Frequência", value: `${stats.visitCount} IDAS`, icon: History },
          { label: "Ticket Médio", value: `R$ ${stats.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: Info },
          { label: "Última Visita", value: stats.lastVisit ? format(stats.lastVisit, "dd/MM/yyyy") : "--", icon: Calendar },
        ].map((kpi, i) => (
          <div key={i} className="bg-surface-section/30 p-5 rounded-[1.5rem] border-none">
            <div className="flex items-center gap-2 text-text-muted mb-1">
              <kpi.icon size={10} />
              <p className="text-[8px] font-black uppercase tracking-widest">{kpi.label}</p>
            </div>
            <h3 className="text-xl font-display font-black text-white tracking-tight">{kpi.value}</h3>
          </div>
        ))}
      </div>

      {/* Preset Section */}
      {(showPreset || client.preset) && (
        <div className="bg-surface-section/30 p-6 rounded-[2rem] space-y-6 border border-brand-primary/5 animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-3">
              <Wand2 size={14} className="text-brand-primary" />
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Preset — Inteligência de Atendimento</h3>
            </div>
            {client.preset && (
              <button 
                onClick={() => { if(confirm("Remover preset de automação?")) updateMutation.mutate({ preset: null }) }}
                className="text-[8px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-all"
              >
                Limpar Preset
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Serviço Padrão", field: "service", placeholder: "EX: CORTE", value: localPreset?.service || "" },
              { label: "Valor Padrão", field: "value", placeholder: "R$ 0,00", value: localPreset?.value || "" },
              { label: "Forma de Pagamento", field: "payment", options: ["PIX", "DINHEIRO", "CARTÃO", "CORTESIA"], value: localPreset?.payment || "PIX" },
              { label: "Dia da Semana Padrão", field: "dayOfWeek", value: localPreset?.dayOfWeek || "" },
              { label: "Horário Padrão", field: "time", placeholder: "EX: 14:00", value: localPreset?.time || "" },
              { label: "Barbeiro Padrão", field: "barberId", value: localPreset?.barberId || "" }
            ].map((cfg, i) => (
              <div key={i} className="bg-surface-page/50 p-4 rounded-xl space-y-1">
                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">{cfg.label}</p>
                {cfg.field === "payment" ? (
                  <PaymentSelector
                    value={cfg.value}
                    onChange={(val) => {
                      const updatedPreset = { ...(localPreset || {}), payment: val };
                      setLocalPreset(updatedPreset);
                      updateMutation.mutate({ preset: updatedPreset });
                    }}
                    isCompact
                  />
                ) : cfg.field === "dayOfWeek" ? (
                  <PremiumSelector
                    value={cfg.value}
                    options={[
                      { value: "", label: "Nenhum" },
                      ...["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"].map(d => ({ value: d, label: d }))
                    ]}
                    onSelect={(val) => {
                      const updatedPreset = { ...(localPreset || {}), dayOfWeek: val };
                      setLocalPreset(updatedPreset);
                      updateMutation.mutate({ preset: updatedPreset });
                    }}
                    className="w-full text-left px-0 py-0.5 justify-start text-[12px] font-black text-white h-auto bg-transparent hover:bg-transparent"
                    dropdownClassName="left-0 right-auto min-w-[160px]"
                  />
                ) : cfg.field === "barberId" ? (
                  <PremiumSelector
                    value={cfg.value}
                    options={[
                      { value: "", label: "Nenhum" },
                      ...barbers.map((b: any) => ({ value: b.id, label: b.nome }))
                    ]}
                    onSelect={(val) => {
                      const updatedPreset = { ...(localPreset || {}), barberId: val ? Number(val) : "" };
                      setLocalPreset(updatedPreset);
                      updateMutation.mutate({ preset: updatedPreset });
                    }}
                    className="w-full text-left px-0 py-0.5 justify-start text-[12px] font-black text-white h-auto bg-transparent hover:bg-transparent"
                    dropdownClassName="left-0 right-auto min-w-[160px]"
                  />
                ) : (
                  <input 
                    type="text"
                    value={cfg.value}
                    placeholder={cfg.placeholder}
                    onChange={(e) => {
                      setLocalPreset({ ...(localPreset || {}), [cfg.field]: e.target.value });
                    }}
                    onBlur={(e) => {
                      const val = e.target.value;
                      const updatedPreset = { ...(localPreset || {}), [cfg.field]: cfg.field === "service" ? val.toUpperCase() : val };
                      updateMutation.mutate({ preset: updatedPreset });
                    }}
                    className="bg-transparent border-none text-[12px] font-black text-white uppercase outline-none w-full p-0"
                  />
                )}
              </div>
            ))}
          </div>

          {localPreset?.dayOfWeek && (
            <div className="flex justify-end pt-2 border-none">
              <button
                type="button"
                onClick={handleGenerateBatch}
                className="py-2.5 px-5 rounded-xl bg-brand-primary text-surface-page text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <CalendarPlus size={14} />
                Gerar Lote de 4 Agendamentos do Plano
              </button>
            </div>
          )}
        </div>
      )}

      {/* Plan Details */}
      {client.plano !== "Nenhum" && (
        <div className="bg-surface-section/30 p-8 rounded-[2.5rem] space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[100px] pointer-events-none" />
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                <Crown size={20} />
              </div>
              <div>
                <select 
                  value={client.plano || ""}
                  onChange={(e) => updateMutation.mutate({ plano: e.target.value })}
                  className="bg-transparent border-none text-xl font-black text-white uppercase tracking-tighter outline-none cursor-pointer hover:text-brand-primary transition-colors appearance-none"
                >
                  {["Nenhum", "Mensal", "Semestral", "Anual", "Pausado"].map(p => (
                    <option key={p} value={p} className="bg-surface-section">{p} Plan</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-brand-primary" />
                  <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Status: Ativo em Ciclo</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => { if(confirm("Reiniciar ciclo de faturamento hoje?")) updateMutation.mutate({ plano_pagamento: new Date().toISOString().split("T")[0] }) }}
              className="text-[9px] font-black text-brand-primary hover:text-white uppercase tracking-widest flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl transition-all"
            >
              <RotateCcw size={12} /> Resetar Ciclo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
             <div className="space-y-4">
                <div className="flex justify-between items-end px-2">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Uso de Créditos</p>
                    <div className="flex items-center gap-2">
                      <h4 className={cn("text-3xl font-display font-black", planUsage.over ? "text-rose-400" : "text-white")}>{planUsage.used}</h4>
                      <span className="text-lg font-bold text-text-muted">/</span>
                      <InlineInput
                        type="number"
                        value={client.limite_cortes || 0}
                        onSave={(v) => updateMutation.mutate({ limite_cortes: parseInt(v) })}
                        className="text-2xl font-black text-text-muted p-0 w-16"
                      />
                    </div>
                  </div>
                  <span className={cn("text-sm font-black", planUsage.over ? "text-rose-400" : "text-brand-primary")}>{planUsage.pct}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all duration-700", planUsage.over ? "bg-rose-500/60" : "bg-brand-primary/50")} style={{ width: `${planUsage.pct}%` }} />
                </div>
             </div>

             <div className="bg-surface-page/30 p-6 rounded-2xl grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Valor do Plano</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-text-muted">R$</span>
                    <InlineInput
                      type="number"
                      value={client.valor_plano?.toFixed(2)}
                      onSave={(v) => updateMutation.mutate({ valor_plano: parseFloat(v) })}
                      className="text-xl font-black text-white p-0 h-auto"
                    />
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Vencimento</p>
                  <input 
                    type="date"
                    defaultValue={client.plano_pagamento}
                    onChange={(e) => updateMutation.mutate({ plano_pagamento: e.target.value })}
                    className="bg-transparent border-none text-sm font-black text-white outline-none cursor-pointer text-right uppercase" style={{ colorScheme: "dark" }}
                  />
                </div>
             </div>
          </div>

          <div className="pt-6 border-t border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Edit3 size={10} className="text-text-muted" />
              <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Observações do Plano</p>
            </div>
            <InlineInput
              value={client.observacoes_plano || "Adicionar observação específica do plano..."}
              onSave={(v) => updateMutation.mutate({ observacoes_plano: v })}
              className="text-xs text-text-muted font-medium italic p-0 hover:text-white transition-all h-auto w-full block"
            />
          </div>
        </div>
      )}

      {/* History Timeline */}
      <div className="space-y-6">
         <div className="flex justify-between items-center px-4">
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Linha do Tempo de Atendimento</h3>
            <div className="h-px flex-1 mx-6 bg-white/5" />
            <span className="text-[9px] font-black text-text-muted tabular-nums">{clientAppointments.length} REGISTROS</span>
         </div>

         <div className="space-y-2">
            {clientAppointments.length === 0 ? (
              <div className="py-20 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest opacity-20">Sem histórico</div>
            ) : (
              clientAppointments.map((appt) => (
                <div key={appt.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 px-6 py-5 bg-surface-section/20 hover:bg-surface-section/40 rounded-3xl transition-all group border-none">
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-surface-page flex flex-col items-center justify-center shadow-lg">
                      <span className="text-[12px] font-black text-brand-primary leading-none">{format(parseISO(appt.date), "dd")}</span>
                      <span className="text-[8px] font-black text-text-muted uppercase leading-none mt-0.5">{format(parseISO(appt.date), "MMM", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-text-muted">
                        <Clock size={12} />
                        <InlineInput
                          type="text"
                          value={appt.time?.substring(0, 5)}
                          onSave={(v) => updateAppointmentMutation.mutate({ id: appt.id, updates: { time: v }, barberId: appt.barberId })}
                          className="text-[11px] font-bold p-0 bg-transparent hover:bg-transparent h-auto"
                        />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 md:pl-4 space-y-0.5">
                    <div className="flex items-center gap-3">
                      <InlineAutocomplete
                        value={appt.service}
                        suggestions={serviceSuggestions}
                        onSave={(v) => updateAppointmentMutation.mutate({ id: appt.id, updates: { service: v }, barberId: appt.barberId })}
                        className="text-[12px] font-black text-white uppercase tracking-wide group-hover:text-brand-primary transition-colors h-auto"
                      />
                      <PaymentSelector
                        value={appt.paymentMethod || "PIX"}
                        onChange={(val) => updateAppointmentMutation.mutate({ id: appt.id, updates: { paymentMethod: val }, barberId: appt.barberId })}
                        isCompact
                        className="w-[120px]"
                      />
                    </div>
                    <InlineInput
                      value={appt.observations || ""}
                      placeholder="Adicionar observação..."
                      onSave={(v) => updateAppointmentMutation.mutate({ id: appt.id, updates: { observations: v }, barberId: appt.barberId })}
                      className="text-[10px] text-text-muted italic truncate max-w-lg p-0 bg-transparent hover:bg-white/5 transition-all text-left block"
                    />
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0">
                    <div className="flex items-center gap-1.5 font-display font-black text-lg text-white">
                      <span className="text-[10px] text-text-muted">R$</span>
                      <InlineInput
                        type="number"
                        value={appt.value?.toString() || "0"}
                        onSave={(v) => updateAppointmentMutation.mutate({ id: appt.id, updates: { value: parseFloat(v) || 0 }, barberId: appt.barberId })}
                        className="p-0 bg-transparent hover:bg-white/5 transition-all h-auto w-16"
                      />
                    </div>
                    <button 
                      onClick={() => { if(confirm("Excluir este agendamento do histórico?")) deleteAppointmentMutation.mutate({ apptId: appt.id, barberId: appt.barberId }) }}
                      className="p-3 rounded-2xl bg-white/5 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all border-none"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
         </div>
      </div>

      {/* Name Change Migration Confirm Modal */}
      <Modal
        isOpen={isNameModalOpen}
        onClose={() => {
          setIsNameModalOpen(false);
          setPendingName("");
        }}
        title="Atualizar Nome e Histórico"
      >
        <div className="flex flex-col gap-4 py-1 text-center">
          <p className="text-[11px] font-bold text-text-secondary leading-normal">
            Deseja migrar todos os agendamentos antigos de <span className="text-white font-black uppercase">"{client.nome}"</span> para o novo nome <span className="text-white font-black uppercase">"{pendingName}"</span>?
          </p>

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => updateClientAndMigrateHistoryMutation.mutate({ newName: pendingName, migrate: true })}
              disabled={updateClientAndMigrateHistoryMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-brand-primary text-surface-page text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              {updateClientAndMigrateHistoryMutation.isPending ? "Migrando..." : "Sim, Migrar Todo o Histórico"}
            </button>
            
            <button
              onClick={() => updateClientAndMigrateHistoryMutation.mutate({ newName: pendingName, migrate: false })}
              disabled={updateClientAndMigrateHistoryMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              Apenas Mudar Nome (Manter Histórico Separado)
            </button>

            <button
              onClick={() => {
                setIsNameModalOpen(false);
                setPendingName("");
              }}
              className="w-full py-2 bg-transparent text-text-muted hover:text-white text-[9px] font-black uppercase tracking-wider border-none cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Auto Batch Scheduling Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => {
          setIsGenerateModalOpen(false);
          setShowFirstDatePicker(false);
          setActiveDatePickerIdx(null);
        }}
        title="Visualizar e Editar Lote do Plano"
      >
        <div className="flex flex-col gap-4 py-1">
          {/* First Date Calendar Picker Selector */}
          <div className="figma-form-group relative">
            <div className="flex justify-between items-center mb-1">
              <label className="figma-form-label mb-0">Data do Primeiro Agendamento</label>
              {generatedAppointments.length >= 2 && (
                <span className="text-[9px] font-black text-brand-primary uppercase tracking-widest bg-brand-primary/5 px-2.5 py-1 rounded-lg">
                  {getDatesRangeLabel()}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowFirstDatePicker(!showFirstDatePicker);
                setActiveDatePickerIdx(null);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-surface-page border border-white/[0.05] text-[11px] font-black uppercase text-left flex items-center justify-between cursor-pointer"
            >
              <span>{firstDate ? format(new Date(firstDate + "T12:00:00"), "dd/MM/yyyy") : "Selecionar Data"}</span>
              <Calendar size={14} className="text-text-secondary" />
            </button>
            {showFirstDatePicker && (
              <div className="absolute left-0 top-full mt-2 z-[9999] bg-[#121214] border border-white/[0.05] rounded-3xl shadow-2xl p-3 figma-datepicker-popover">
                <DayPicker
                  mode="single"
                  selected={firstDate ? new Date(firstDate + "T12:00:00") : undefined}
                  onSelect={(d) => {
                    if (d) {
                      const formatted = format(d, "yyyy-MM-dd");
                      setFirstDate(formatted);
                      regenerateList(formatted);
                      setShowFirstDatePicker(false);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Interval and Quantity Configuration Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="figma-form-group">
              <label className="figma-form-label">Intervalo (Dias)</label>
              <input
                type="number"
                min="1"
                max="90"
                value={intervalDays}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setIntervalDays(val);
                  regenerateList(firstDate, val, batchCount);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-surface-page border border-white/[0.05] text-[11px] font-black uppercase outline-none text-white focus:border-brand-primary transition-all"
              />
            </div>
            <div className="figma-form-group">
              <label className="figma-form-label">Quantidade de Agendamentos</label>
              <input
                type="number"
                min="1"
                max="24"
                value={batchCount}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setBatchCount(val);
                  regenerateList(firstDate, intervalDays, val);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-surface-page border border-white/[0.05] text-[11px] font-black uppercase outline-none text-white focus:border-brand-primary transition-all"
              />
            </div>
          </div>

          <p className="text-[11px] font-bold text-text-secondary leading-normal">
            Confirme as datas e horários dos {batchCount} agendamentos do plano para <span className="text-white font-black uppercase">"{client.nome}"</span>:
          </p>

          <div className="space-y-3">
            {generatedAppointments.map((appt, idx) => (
              <div key={idx} className="bg-surface-page/50 p-3 rounded-xl flex items-center justify-between gap-3 border border-white/5 relative">
                {/* Calendar Button for Individual Week Date */}
                <div className="flex flex-col gap-1 relative">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">Semana {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFirstDatePicker(false);
                      setActiveDatePickerIdx(activeDatePickerIdx === idx ? null : idx);
                    }}
                    className="bg-transparent border-none text-[11px] font-black text-white outline-none flex items-center gap-1.5 cursor-pointer p-0"
                  >
                    <span>{appt.date ? format(new Date(appt.date + "T12:00:00"), "dd/MM/yyyy") : "---"}</span>
                    <Calendar size={11} className="text-text-secondary" />
                  </button>
                  {activeDatePickerIdx === idx && (
                    <div className="absolute left-0 top-full mt-2 z-[9999] bg-[#121214] border border-white/[0.05] rounded-3xl shadow-2xl p-3 figma-datepicker-popover">
                      <DayPicker
                        mode="single"
                        selected={appt.date ? new Date(appt.date + "T12:00:00") : undefined}
                        onSelect={(d) => {
                          if (d) {
                            const updated = [...generatedAppointments];
                            updated[idx].date = format(d, "yyyy-MM-dd");
                            setGeneratedAppointments(updated);
                            setActiveDatePickerIdx(null);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">Horário</span>
                  <input
                    type="time"
                    value={appt.time}
                    onChange={(e) => {
                      const updated = [...generatedAppointments];
                      updated[idx].time = e.target.value;
                      setGeneratedAppointments(updated);
                    }}
                    className="bg-transparent border-none text-[11px] font-black text-white outline-none w-16"
                  />
                </div>

                <div className="flex flex-col gap-1 min-w-[90px]">
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">Barbeiro</span>
                  <PremiumSelector
                    value={appt.barberId}
                    options={barbers.map((b: any) => ({ value: b.id, label: b.nome }))}
                    onSelect={(val) => {
                      const updated = [...generatedAppointments];
                      updated[idx].barberId = Number(val);
                      setGeneratedAppointments(updated);
                    }}
                    className="bg-transparent text-[11px] font-black text-white p-0 hover:bg-transparent h-auto cursor-pointer justify-start"
                    dropdownClassName="left-auto right-0 min-w-[120px]"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 w-full pt-2">
            <button
              onClick={() => saveBatchMutation.mutate()}
              disabled={saveBatchMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-brand-primary text-surface-page text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              {saveBatchMutation.isPending ? "Agendando Lote..." : "Confirmar e Salvar Lote"}
            </button>
            
            <button
              onClick={() => {
                setIsGenerateModalOpen(false);
                setShowFirstDatePicker(false);
                setActiveDatePickerIdx(null);
              }}
              className="w-full py-2 bg-transparent text-text-muted hover:text-white text-[9px] font-black uppercase tracking-wider border-none cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
