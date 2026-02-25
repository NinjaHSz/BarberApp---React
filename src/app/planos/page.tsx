"use client";

import { useClients, useSupabase } from "@/hooks/use-data";
import { Plus, Search, Users, Clock, Banknote, RotateCcw, Pause, Edit2, Play, Crown, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PremiumSelector } from "@/components/shared/premium-selector";
import { Modal } from "@/components/shared/modal";
import { InlineInput } from "@/components/shared/inline-input";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

export default function PlansPage() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: clients = [], isLoading: loadingClients } = useClients();

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [usageByClient, setUsageByClient] = useState<Record<string, number>>({});

  const clientsWithPlans = useMemo(() => {
    return clients.filter(c => c.plano && c.plano !== "Nenhum");
  }, [clients]);

  const filteredPlans = useMemo(() => {
    let result = [...clientsWithPlans];
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(c => c.nome?.toLowerCase().includes(s));
    }
    return result.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [clientsWithPlans, searchTerm]);

  // Usos reais por cliente: query no banco filtrando desde plano_pagamento
  useEffect(() => {
    if (!clientsWithPlans.length) return;
    const fetchUsage = async () => {
      const map: Record<string, number> = {};
      await Promise.all(
        clientsWithPlans.map(async (c) => {
          const clientName = c.nome || "";
          
          // 1. Find the latest "RENOVAÇÃO" appointment date for this client
          const { data: latestRenov } = await supabase
            .from("agendamentos")
            .select("data")
            .ilike("cliente", clientName)
            .ilike("procedimento", "%renova%")
            .order("data", { ascending: false })
            .limit(1);

          const startDate = latestRenov?.[0]?.data || c.plano_pagamento;

          // 2. Count usages from that date forward
          let query = supabase
            .from("agendamentos")
            .select("id", { count: "exact", head: true })
            .ilike("cliente", clientName)
            .or(`procedimento.ilike.%dia%,procedimento.ilike.%renova%`);

          if (startDate) {
            query = query.gte("data", startDate);
          }

          const { count } = await query;
          map[c.id] = count ?? 0;
        })
      );
      setUsageByClient(map);
    };
    fetchUsage();
  }, [clientsWithPlans, supabase]);


  const stats = useMemo(() => {
    const active = clientsWithPlans.filter(c => c.plano !== "Pausado").length;
    const pending = clientsWithPlans.filter(c => {
      if (!c.plano_pagamento) return true;
      const diff = differenceInDays(new Date(), parseISO(c.plano_pagamento));
      return diff > 30;
    }).length;
    const mrr = clientsWithPlans.reduce((acc, c) => acc + (c.valor_plano || 0), 0);
    return { active, pending, mrr };
  }, [clientsWithPlans]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const { error } = await supabase.from("clientes").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const existing = clients.find(c => c.nome?.toLowerCase() === data.nome.toLowerCase());
      if (existing) {
        const { error } = await supabase.from("clientes").update(data).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setIsModalOpen(false);
      setEditingPlan(null);
    },
  });

  const handleResetCycle = (client: any) => {
    if (confirm(`Reiniciar ciclo de ${client.nome} hoje?`)) {
      updateMutation.mutate({
        id: client.id,
        data: { plano_pagamento: new Date().toISOString().split("T")[0] }
      });
    }
  };

  const handleToggleStatus = (client: any) => {
    const newStatus = client.plano === "Pausado" ? "Mensal" : "Pausado";
    updateMutation.mutate({
      id: client.id,
      data: { plano: newStatus }
    });
  };

  if (loadingClients) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 sm:px-8 sm:pt-6 space-y-8 animate-in fade-in duration-500 pb-32 max-w-7xl mx-auto">
      {/* Header & KPIs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl md:text-3xl font-black tracking-tight text-text-primary uppercase italic">
            Gestão de Planos <span className="text-text-secondary font-medium lowercase">({clientsWithPlans.length})</span>
          </h2>
          <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Retenção e Fidelidade VIP</p>
        </div>

        <div className="flex flex-wrap gap-4 w-full md:w-auto">
           <div className="bg-surface-section/50 px-6 py-4 rounded-[2rem] flex items-center gap-4 border-none shadow-xl">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/5 flex items-center justify-center text-brand-primary"><Users size={18} /></div>
              <div>
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Ativos</p>
                <h3 className="text-lg font-black text-white leading-none mt-1">{stats.active}</h3>
              </div>
           </div>
           <div className="bg-surface-section/50 px-6 py-4 rounded-[2rem] flex items-center gap-4 border-none shadow-xl">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/5 flex items-center justify-center text-text-muted"><Clock size={18} /></div>
              <div>
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Pendentes</p>
                <h3 className="text-lg font-black text-white leading-none mt-1">{stats.pending}</h3>
              </div>
           </div>
           <button
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-primary text-surface-page px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-brand-primary/10 border-none justify-center"
          >
            <Plus size={16} /> Novo Assinante
          </button>
        </div>
      </div>

      {/* Search & Metrics Summary */}
      <div className="flex flex-wrap gap-4 items-center bg-surface-section/30 p-4 rounded-[1.5rem] border-none shadow-2xl">
        <div className="flex-1 min-w-[240px] relative group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-primary transition-colors" size={16} />
          <input
            type="text"
            placeholder="Buscar por nome do assinante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-page/50 border-none pl-12 pr-4 h-11 rounded-2xl outline-none focus:bg-surface-page/80 transition-all font-bold text-xs uppercase text-white shadow-inner"
          />
        </div>
        <div className="px-6 py-3 bg-brand-primary/10 rounded-2xl flex flex-col justify-center border-none">
          <span className="text-[8px] font-black uppercase text-brand-primary/60 tracking-widest">Receita MensalEstimada (MRR)</span>
          <span className="text-lg font-black text-brand-primary tabular-nums">
            R$ {stats.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Plan Rows */}
      <div className="space-y-2">
        {filteredPlans.length === 0 ? (
          <div className="py-20 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest opacity-20">Nenhum assinante encontrado</div>
        ) : (
          filteredPlans.map((c) => {
            const isPending = c.plano_pagamento && differenceInDays(new Date(), parseISO(c.plano_pagamento)) > 30;
            return (
              <div key={c.id} className="bg-surface-section/20 p-5 rounded-[2rem] transition-all group flex flex-col lg:flex-row items-center gap-8 border-none hover:bg-surface-section/40">
                {/* User Info */}
                <div className="flex items-center gap-5 w-full lg:w-72 shrink-0">
                   <div className="w-12 h-12 rounded-[1.25rem] bg-surface-page flex items-center justify-center text-brand-primary font-black text-lg shadow-2xl">
                      {c.nome?.charAt(0)}
                   </div>
                   <div className="min-w-0">
                      <Link href={`/clientes/${c.id}`} className="text-[13px] font-black text-white hover:text-brand-primary block uppercase tracking-tight truncate transition-colors">
                        {c.nome}
                      </Link>
                      <select 
                        value={c.plano || ""}
                        onChange={(e) => updateMutation.mutate({ id: c.id, data: { plano: e.target.value } })}
                        className="bg-transparent border-none text-[9px] font-black text-text-muted hover:text-white uppercase tracking-widest p-0 mt-0.5 outline-none cursor-pointer appearance-none"
                      >
                         <option value="Mensal" className="bg-surface-section">Plano Mensal</option>
                         <option value="Semestral" className="bg-surface-section">Plano Semestral</option>
                         <option value="Anual" className="bg-surface-section">Plano Anual</option>
                         <option value="Pausado" className="bg-surface-section">Pausado</option>
                      </select>
                   </div>
                </div>

                {/* Usage */}
                <div className="flex flex-col gap-1.5 w-full lg:w-48 shrink-0">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase">
                      <div className="flex items-center gap-1.5">
                          <span className={cn("text-white", (usageByClient[c.id] ?? 0) >= (c.limite_cortes || Infinity) && "text-rose-400")}>{usageByClient[c.id] ?? 0}</span>
                         <span className="text-text-muted opacity-30">/</span>
                         <InlineInput
                          type="number"
                          value={c.limite_cortes || 0}
                          onSave={(v) => updateMutation.mutate({ id: c.id, data: { limite_cortes: parseInt(v) } })}
                          className="text-text-muted p-0 w-8 h-auto"
                         />
                      </div>
                       <span className={cn("text-[9px] font-bold", (usageByClient[c.id] ?? 0) >= (c.limite_cortes || Infinity) ? "text-rose-400" : "text-text-muted/40")}>{c.limite_cortes > 0 ? Math.min(Math.round(((usageByClient[c.id] ?? 0) / c.limite_cortes) * 100), 100) : 0}%</span>
                   </div>
                   <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                       <div className={cn("h-full transition-all duration-700", (usageByClient[c.id] ?? 0) >= (c.limite_cortes || Infinity) ? "bg-rose-500/60" : "bg-brand-primary/40")} style={{ width: `${c.limite_cortes > 0 ? Math.min(Math.round(((usageByClient[c.id] ?? 0) / c.limite_cortes) * 100), 100) : 0}%` }} />
                   </div>
                </div>

                {/* Ciclo / Pagamento */}
                <div className="flex flex-col w-full lg:w-40 shrink-0">
                  <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1.5">Renovação</p>
                  <input 
                    type="date"
                    value={c.plano_pagamento || ""}
                    onChange={(e) => updateMutation.mutate({ id: c.id, data: { plano_pagamento: e.target.value } })}
                    className={cn(
                      "bg-transparent border-none text-[11px] font-black p-0 outline-none cursor-pointer uppercase",
                      isPending ? "text-rose-500" : "text-white"
                    )}
                    style={{ colorScheme: "dark" }}
                  />
                </div>

                {/* Valor */}
                <div className="flex flex-col w-full lg:w-28 shrink-0">
                   <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1.5">Mensalidade</p>
                   <div className="flex items-center gap-1.5 font-black text-white text-[12px]">
                      <InlineInput
                        type="number"
                        prefix="R$"
                        value={c.valor_plano?.toFixed(2)}
                        onSave={(v) => updateMutation.mutate({ id: c.id, data: { valor_plano: parseFloat(v) } })}
                        className="p-0 h-auto font-black"
                      />
                   </div>
                </div>

                {/* OBS */}
                <div className="flex-1 min-w-0 w-full hidden lg:block">
                  <InlineInput
                    value={c.observacoes_plano || "Add observação..."}
                    onSave={(v) => updateMutation.mutate({ id: c.id, data: { observacoes_plano: v } })}
                    className="text-[10px] text-text-muted italic p-0 hover:text-white truncate"
                  />
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                   <button onClick={() => handleResetCycle(c)} className="p-3 rounded-2xl bg-white/5 text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-all border-none" title="Reset Ciclo"><RotateCcw size={14} /></button>
                   <button onClick={() => handleToggleStatus(c)} className="p-3 rounded-2xl bg-white/5 text-text-muted hover:text-white transition-all border-none" title={c.plano === "Pausado" ? "Ativar" : "Pausar"}>
                     {c.plano === "Pausado" ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                   </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Subscriber Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Novo Assinante VIP"
      >
         <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const data: any = {
            nome: String(formData.get("nome")),
            plano: String(formData.get("plano")),
            plano_pagamento: new Date().toISOString().split("T")[0],
            limite_cortes: parseInt(String(formData.get("limite_cortes"))) || 99,
            valor_plano: parseFloat(String(formData.get("valor_plano"))) || 0,
          };
          saveMutation.mutate(data);
        }} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Cliente</label>
            <AutocompleteInput
              value={editingPlan?.nome || ""}
              onChange={(v) => setEditingPlan((prev: any) => ({ ...prev, nome: v }))}
              suggestions={clients.map(c => ({ id: c.nome, label: c.nome, value: c }))}
              onSelect={(v) => setEditingPlan((prev: any) => ({ ...prev, nome: v.label }))}
              placeholder="BUSCAR OU DIGITAR NOME..."
              inputClassName="bg-surface-page/50 font-bold uppercase"
            />
            <input type="hidden" name="nome" value={editingPlan?.nome || ""} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Modalidade</label>
              <select name="plano" className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black uppercase text-xs appearance-none">
                <option value="Mensal" className="bg-surface-section px-4">Plano Mensal</option>
                <option value="Semestral" className="bg-surface-section px-4">Plano Semestral</option>
                <option value="Anual" className="bg-surface-section px-4">Plano Anual</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Cortes no Ciclo</label>
              <input type="number" name="limite_cortes" defaultValue={99} className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black text-sm" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Valor do Plano (R$)</label>
            <input type="number" step="0.01" name="valor_plano" placeholder="0,00" required className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black text-xl text-brand-primary" />
          </div>

          <button type="submit" disabled={saveMutation.isPending} className="w-full bg-brand-primary text-surface-page font-black py-4 rounded-2xl border-none uppercase tracking-widest text-xs shadow-xl shadow-brand-primary/10 transition-all active:scale-[0.98]">
            {saveMutation.isPending ? "Processando..." : "Ativar Assinatura"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
