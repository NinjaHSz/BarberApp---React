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

  // Usos reais por cliente: query no banco filtrando desde o último agendamento de renovação
  useEffect(() => {
    if (!clientsWithPlans.length) return;
    const fetchUsage = async () => {
      const map: Record<string, number> = {};
      await Promise.all(
        clientsWithPlans.map(async (c) => {
          const clientName = c.nome || "";
          
          // Find the latest "RENOVAÇÃO" appointment date for this client
          const { data: latestRenov } = await supabase
            .from("agendamentos")
            .select("data")
            .ilike("cliente", clientName)
            .ilike("procedimento", "%renova%")
            .order("data", { ascending: false })
            .limit(1);

          const startDate = latestRenov?.[0]?.data;
          const todayStr = format(new Date(), "yyyy-MM-dd");

          // Count usage from that date forward
          let query = supabase
            .from("agendamentos")
            .select("data, procedimento")
            .ilike("cliente", clientName)
            .neq("cliente", "PAUSA");

          if (startDate) {
            query = query.gte("data", startDate);
          }

          const { data: usageData } = await query;
          
          const filteredUsage = (usageData || []).filter(u => {
            const proc = (u.procedimento || "").toUpperCase().trim();
            if (proc === "RENOVAÇÃO 1º DIA") return true;
            return /^(\d+)º\s*DIA$/.test(proc);
          });

          map[c.id] = filteredUsage.length;
        })
      );
      setUsageByClient(map);
    };
    fetchUsage();
  }, [clientsWithPlans, supabase]);

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
    <div className="px-4 pt-6 sm:px-8 sm:pt-6 space-y-6 animate-in fade-in duration-500 pb-32 max-w-7xl mx-auto">
      {/* Header and Search/Controls Row */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-text-primary uppercase italic leading-none">
              Gestão de Planos <span className="text-text-secondary font-medium lowercase">({clientsWithPlans.length})</span>
            </h2>
            <p className="text-[8px] font-black text-text-muted uppercase tracking-[0.2em] mt-1">Retenção e Fidelidade VIP</p>
          </div>
        </div>

        {/* Controls Container */}
        <div className="flex flex-wrap items-center gap-3 flex-1 xl:justify-end">
          {/* Search Box */}
          <div className="flex flex-wrap gap-2 items-center bg-surface-section/30 p-2 rounded-2xl border-none shadow-2xl flex-1 max-w-xl">
            <div className="flex-1 min-w-[200px] relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-primary transition-colors" size={14} />
              <input
                type="text"
                placeholder="Buscar por nome do assinante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-page/50 border-none pl-9 pr-3 h-9 rounded-xl outline-none focus:bg-surface-page/80 transition-all font-bold text-[10px] uppercase text-white shadow-inner"
              />
            </div>
          </div>

          {/* Cadastrar button as a small square next to search */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-10 h-10 bg-brand-primary text-surface-page rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-primary/10 border-none shrink-0 cursor-pointer"
            title="Novo Assinante"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Plan Rows */}
      <div className="space-y-2">
        {filteredPlans.length === 0 ? (
          <div className="py-20 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest opacity-20">Nenhum assinante encontrado</div>
        ) : (
          filteredPlans.map((c) => {
            return (
              <div key={c.id} className="bg-surface-section/20 p-3 lg:p-5 rounded-[1.5rem] lg:rounded-[2rem] transition-all group flex flex-col lg:flex-row items-center gap-4 lg:gap-8 border-none hover:bg-surface-section/40">
                {/* User Info */}
                <div className="flex items-center gap-3 lg:gap-5 w-full lg:w-72 shrink-0">
                   <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-[1.25rem] bg-surface-page flex items-center justify-center text-brand-primary font-black text-base lg:text-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in">
                      {c.foto_url ? (
                        <img 
                          src={c.foto_url} 
                          alt={c.nome} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        c.nome?.charAt(0)
                      )}
                   </div>
                   <div className="min-w-0 flex-1 lg:flex-none">
                      <Link href={`/clientes/${c.id}`} className="text-xs lg:text-[13px] font-black text-white hover:text-brand-primary block uppercase tracking-tight truncate transition-colors">
                        {c.nome}
                      </Link>
                      <select 
                        value={c.plano || ""}
                        onChange={(e) => updateMutation.mutate({ id: c.id, data: { plano: e.target.value } })}
                        className="bg-transparent border-none text-[8px] lg:text-[9px] font-black text-text-muted hover:text-white uppercase tracking-widest p-0 mt-0.5 outline-none cursor-pointer appearance-none"
                      >
                         <option value="Mensal" className="bg-surface-section">Plano Mensal</option>
                         <option value="Semestral" className="bg-surface-section">Plano Semestral</option>
                         <option value="Anual" className="bg-surface-section">Plano Anual</option>
                         <option value="Pausado" className="bg-surface-section">Pausado</option>
                      </select>
                   </div>
                   {/* Mobile Actions - Removed as requested */}
                </div>

                {/* Grid for parameters on mobile - Otimizado para aparecer apenas Uso */}
                <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8 w-full flex-1">
                  {/* Usage */}
                  <div className="flex flex-col gap-1 w-full lg:w-48 shrink-0">
                    <div className="flex justify-between items-center text-[9px] lg:text-[10px] font-black uppercase">
                        <div className="flex items-center gap-1">
                            <span className={cn("text-white", (usageByClient[c.id] ?? 0) >= (c.limite_cortes || Infinity) && "text-rose-400")}>{usageByClient[c.id] ?? 0}</span>
                           <span className="text-text-muted opacity-30">/</span>
                           <InlineInput
                            type="number"
                            value={c.limite_cortes || 0}
                            onSave={(v) => updateMutation.mutate({ id: c.id, data: { limite_cortes: parseInt(v) } })}
                            className="text-text-muted p-0 w-6 lg:w-8 h-auto"
                           />
                        </div>
                         <span className={cn("text-[8px] lg:text-[9px] font-bold", (usageByClient[c.id] ?? 0) >= (c.limite_cortes || Infinity) ? "text-rose-400" : "text-text-muted/40")}>{c.limite_cortes > 0 ? Math.min(Math.round(((usageByClient[c.id] ?? 0) / c.limite_cortes) * 100), 100) : 0}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className={cn("h-full transition-all duration-700", (usageByClient[c.id] ?? 0) >= (c.limite_cortes || Infinity) ? "bg-rose-500/60" : "bg-brand-primary/40")} style={{ width: `${c.limite_cortes > 0 ? Math.min(Math.round(((usageByClient[c.id] ?? 0) / c.limite_cortes) * 100), 100) : 0}%` }} />
                    </div>
                  </div>



                  {/* Valor - Desktop Only */}
                  <div className="hidden lg:flex flex-col w-full lg:w-28 shrink-0">
                    <p className="text-[7px] lg:text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5 lg:mb-1.5">Mensalidade</p>
                    <div className="flex items-center gap-1 font-black text-white text-[11px] lg:text-[12px]">
                        <InlineInput
                          type="number"
                          prefix="R$"
                          value={c.valor_plano?.toFixed(2)}
                          onSave={(v) => updateMutation.mutate({ id: c.id, data: { valor_plano: parseFloat(v) } })}
                          className="p-0 h-auto font-black"
                        />
                    </div>
                  </div>
                </div>

                {/* OBS - Desktop */}
                <div className="flex-1 min-w-0 w-full hidden lg:block">
                  <InlineInput
                    value={c.observacoes_plano || "Add observação..."}
                    onSave={(v) => updateMutation.mutate({ id: c.id, data: { observacoes_plano: v } })}
                    className="text-[10px] text-text-muted italic p-0 hover:text-white truncate"
                  />
                </div>

                {/* Ações - Desktop */}
                <div className="hidden lg:flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
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
        }} className="flex flex-col gap-3 py-2 w-full">
          <div className="figma-form-group">
            <label className="figma-form-label">Cliente</label>
            <AutocompleteInput
              value={editingPlan?.nome || ""}
              onChange={(v) => setEditingPlan((prev: any) => ({ ...prev, nome: v }))}
              suggestions={clients.map(c => ({ id: c.nome, label: c.nome, value: c }))}
              onSelect={(v) => setEditingPlan((prev: any) => ({ ...prev, nome: v.label }))}
              placeholder="BUSCAR OU DIGITAR NOME..."
              inputClassName="figma-form-input font-bold uppercase"
            />
            <input type="hidden" name="nome" value={editingPlan?.nome || ""} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="figma-form-group">
              <label className="figma-form-label">Modalidade</label>
              <select name="plano" className="figma-form-input font-bold uppercase appearance-none">
                <option value="Mensal" className="bg-[#18181B] px-4">Plano Mensal</option>
                <option value="Semestral" className="bg-[#18181B] px-4">Plano Semestral</option>
                <option value="Anual" className="bg-[#18181B] px-4">Plano Anual</option>
              </select>
            </div>
            <div className="figma-form-group">
              <label className="figma-form-label">Cortes no Ciclo</label>
              <input type="number" name="limite_cortes" defaultValue={99} className="figma-form-input font-bold" />
            </div>
          </div>

          <div className="figma-form-group">
            <label className="figma-form-label">Valor do Plano (R$)</label>
            <input type="number" step="0.01" name="valor_plano" placeholder="0,00" required className="figma-form-input font-bold" />
          </div>

          <button type="submit" disabled={saveMutation.isPending} className="figma-form-button-save border-none">
            {saveMutation.isPending ? "Processando..." : "Salvar"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
