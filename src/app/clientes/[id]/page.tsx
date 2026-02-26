"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useClients, useSupabase, useAppointments, useProcedures } from "@/hooks/use-data";
import { ChevronLeft, Crown, Wand2, Trash2, Calendar, TrendingUp, History, Info, RotateCcw, Plus, Clock, CreditCard, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InlineInput } from "@/components/shared/inline-input";
import { InlineAutocomplete } from "@/components/shared/inline-autocomplete";
import { PaymentSelector } from "@/components/shared/payment-selector";

export default function ClientProfilePage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: appointments = [], isLoading: loadingAppointments } = useAppointments();
  const { data: procedures = [] } = useProcedures();

  const [showPreset, setShowPreset] = useState(false);
  const [dbUsage, setDbUsage] = useState(0);

  const client = useMemo(() => clients.find(c => String(c.id) === id), [clients, id]);

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

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id: apptId, updates }: { id: string, updates: any }) => {
      const dbUpdates: any = {};
      if (updates.service !== undefined) dbUpdates.procedimento = updates.service;
      if (updates.value !== undefined) dbUpdates.valor = updates.value;
      if (updates.observations !== undefined) dbUpdates.observacoes = updates.observations;
      if (updates.paymentMethod !== undefined) dbUpdates.forma_pagamento = updates.paymentMethod;
      if (updates.time !== undefined) dbUpdates.horario = updates.time;

      const { error } = await supabase.from("agendamentos").update(dbUpdates).eq("id", apptId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (apptId: string) => {
      const { error } = await supabase.from("agendamentos").delete().eq("id", apptId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

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
            <InlineInput
              value={client.nome}
              onSave={(v) => updateMutation.mutate({ nome: v })}
              className="text-3xl font-display font-black text-white bg-transparent p-0 uppercase tracking-tighter hover:text-brand-primary transition-colors h-auto w-auto"
            />
            {client.plano !== "Nenhum" && (
              <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black uppercase rounded border border-brand-primary/20">VIP</span>
            )}
          </div>
          <InlineInput
            value={client.observacoes_cliente || "Adicionar nota..."}
            onSave={(v) => updateMutation.mutate({ observacoes_cliente: v })}
            className="text-xs text-text-muted font-medium italic p-0 hover:text-white transition-all h-auto w-full md:w-max block"
          />
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Serviço Padrão", field: "service", placeholder: "EX: CORTE", value: client.preset?.service },
              { label: "Valor Padrão", field: "value", placeholder: "R$ 0,00", value: client.preset?.value },
              { label: "Forma de Pagamento", field: "payment", options: ["PIX", "DINHEIRO", "CARTÃO", "CORTESIA"], value: client.preset?.payment }
            ].map((cfg, i) => (
              <div key={i} className="bg-surface-page/50 p-4 rounded-xl space-y-1">
                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">{cfg.label}</p>
                {cfg.options ? (
                  <PaymentSelector
                    value={cfg.value || "PIX"}
                    onChange={(val) => updateMutation.mutate({ preset: { ...client.preset, payment: val } })}
                    isCompact
                  />
                ) : (
                  <input 
                    type="text"
                    defaultValue={cfg.value}
                    placeholder={cfg.placeholder}
                    onBlur={(e) => updateMutation.mutate({ preset: { ...client.preset, [cfg.field]: e.target.value.toUpperCase() } })}
                    className="bg-transparent border-none text-[12px] font-black text-white uppercase outline-none w-full p-0"
                  />
                )}
              </div>
            ))}
          </div>
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
                          onSave={(v) => updateAppointmentMutation.mutate({ id: appt.id, updates: { time: v } })}
                          className="text-[11px] font-bold p-0 bg-transparent hover:bg-transparent h-auto"
                        />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 md:pl-4 space-y-0.5">
                    <div className="flex items-center gap-3">
                      <InlineAutocomplete
                        value={appt.service}
                        suggestions={serviceSuggestions}
                        onSave={(v) => updateAppointmentMutation.mutate({ id: appt.id, updates: { service: v } })}
                        className="text-[12px] font-black text-white uppercase tracking-wide group-hover:text-brand-primary transition-colors h-auto"
                      />
                      <PaymentSelector
                        value={appt.paymentMethod || "PIX"}
                        onChange={(val) => updateAppointmentMutation.mutate({ id: appt.id, updates: { paymentMethod: val } })}
                        isCompact
                        className="w-[120px]"
                      />
                    </div>
                    <InlineInput
                      value={appt.observations || ""}
                      placeholder="Adicionar observação..."
                      onSave={(v) => updateAppointmentMutation.mutate({ id: appt.id, updates: { observations: v } })}
                      className="text-[10px] text-text-muted italic truncate max-w-lg p-0 bg-transparent hover:bg-white/5 transition-all text-left block"
                    />
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0">
                    <div className="flex items-center gap-1.5 font-display font-black text-lg text-white">
                      <span className="text-[10px] text-text-muted">R$</span>
                      <InlineInput
                        type="number"
                        value={appt.value?.toString() || "0"}
                        onSave={(v) => updateAppointmentMutation.mutate({ id: appt.id, updates: { value: parseFloat(v) || 0 } })}
                        className="p-0 bg-transparent hover:bg-white/5 transition-all h-auto w-16"
                      />
                    </div>
                    <button 
                      onClick={() => { if(confirm("Excluir este agendamento do histórico?")) deleteAppointmentMutation.mutate(appt.id) }}
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
    </div>
  );
}
