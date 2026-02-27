"use client";

import { useExpenses, useSupabase, useCards } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth, addDays, subDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Search, Filter, Trash2, Edit2, RotateCcw, XCircle, Calendar, CreditCard, DollarSign, Check, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { PremiumSelector } from "@/components/shared/premium-selector";
import { useAgenda } from "@/lib/contexts/agenda-context";
import { Modal } from "@/components/shared/modal";
import { InlineInput } from "@/components/shared/inline-input";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses();
  const { data: cards = [] } = useCards();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [periodFilter, setPeriodFilter] = useState("mensal");
  const [sortField, setSortField] = useState("vencimento_asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSlots, setCopiedSlots] = useState<string[]>([]);
  const [periodFilterName, setPeriodFilterName] = useState("");
  const [lastAction, setLastAction] = useState<{ type: string, data: any } | null>(null);

  const { selectedDate, setSelectedDate } = useAgenda();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleDayChange = useCallback((delta: number) => {
    setSelectedDate(prev => delta > 0 ? addDays(prev, delta) : subDays(prev, Math.abs(delta)));
  }, [setSelectedDate]);

  const handleDaySelect = useCallback((day: number) => { 
    setSelectedDate(prev => { const d = new Date(prev); d.setDate(day); return d; }); 
  }, [setSelectedDate]);

  const handleMonthSelect = useCallback((month: number) => { 
    setSelectedDate(prev => { const d = new Date(prev); d.setMonth(month - 1); return d; }); 
  }, [setSelectedDate]);

  const handleYearSelect = useCallback((year: number) => { 
    setSelectedDate(prev => { const d = new Date(prev); d.setFullYear(year); return d; }); 
  }, [setSelectedDate]);

  const handleSync = async () => { 
    setIsSyncing(true); 
    await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    await new Promise(r => setTimeout(r, 800)); 
    setIsSyncing(false); 
  };

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
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

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const { error } = await supabase.from("saidas").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saidas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        const { error } = await supabase.from("saidas").update(data).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saidas").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setIsModalOpen(false);
      setEditingExpense(null);
    },
  });

  // Jarvis Integration - MOVED HERE to avoid reference errors
  const expensesRef = useRef(expenses);
  useEffect(() => { expensesRef.current = expenses; }, [expenses]);

  useEffect(() => {
    const handleJarvis = async (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail) return;
      
      const { type, payload } = customEvent.detail;
      if (type !== "JARVIS_CHAT_COMMAND") return;

      const { intent, clientName, id, updates, action, sourceMonth, targetMonth, targetTable } = payload;

      // Só processa se for para a tabela de saídas
      if (targetTable && targetTable !== "saidas") return;

      // 1. AÇÃO EM MASSA (Bulk Action) - Mover mês
      if (intent === "bulk_action" && action === "mover_mes") {
        const sMonth = Number(sourceMonth);
        const tMonth = Number(targetMonth);
        
        const year = new Date().getFullYear();
        const toUpdate = expensesRef.current.filter(e => {
          const d = parseISO(e.vencimento);
          return d.getMonth() + 1 === sMonth && d.getFullYear() === year;
        });

        if (toUpdate.length === 0) return;

        // SALVAR PARA DESFAZER
        const backup = toUpdate.map(e => ({ id: e.id, vencimento: e.vencimento }));
        setLastAction({ type: "mover_mes", data: backup });

        const promises = toUpdate.map(e => {
          const d = parseISO(e.vencimento);
          d.setMonth(tMonth - 1);
          if (tMonth < sMonth) d.setFullYear(year + 1);
          return supabase.from("saidas").update({ vencimento: format(d, "yyyy-MM-dd") }).eq("id", e.id);
        });

        await Promise.all(promises);
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        
        setPeriodFilterName("Mover Mês");
        setCopiedSlots([`${toUpdate.length} contas movidas`]);
        setCopied(true);
        setTimeout(() => { 
          setCopied(false);
          setLastAction(null);
        }, 3000);
      }

      // 2. DELETAR
      if (intent === "deletar") {
        const dName = clientName?.toLowerCase() || ""; 
        const match = expensesRef.current.find(e => e.descricao?.toLowerCase().includes(dName));
        if (match) {
          setLastAction({ type: "deletar", data: match });
          deleteMutation.mutate(match.id);
          setPeriodFilterName("Excluir");
          setCopiedSlots([`Conta "${match.descricao}" removida`]);
          setCopied(true);
        }
      }

      // 3. EDITAR
      if (intent === "editar" && updates) {
        const dName = clientName?.toLowerCase() || ""; 
        const match = expensesRef.current.find(e => e.descricao?.toLowerCase().includes(dName));
        if (match) {
          setLastAction({ type: "editar", data: { ...match } });
          const cleanData: any = {};
          if (updates.time) cleanData.vencimento = updates.time;
          if (updates.clientName) cleanData.descricao = updates.clientName.toUpperCase();
          if (updates.value) cleanData.valor = updates.value;
          updateMutation.mutate({ id: match.id, data: cleanData });
        }
      }
    };

    window.addEventListener("jarvis-action", handleJarvis);
    window.addEventListener("jarvis-undo", handleUndo);
    return () => {
      window.removeEventListener("jarvis-action", handleJarvis);
      window.removeEventListener("jarvis-undo", handleUndo);
    };
  }, [supabase, queryClient, deleteMutation, updateMutation, lastAction]);

  const handleUndo = async () => {
    if (!lastAction) return;

    if (lastAction.type === "mover_mes") {
      const promises = lastAction.data.map((item: any) => 
        supabase.from("saidas").update({ vencimento: item.vencimento }).eq("id", item.id)
      );
      await Promise.all(promises);
    } else if (lastAction.type === "deletar") {
      const { id, created_at, ...rest } = lastAction.data;
      await supabase.from("saidas").insert([rest]);
    } else if (lastAction.type === "editar") {
      const { id, created_at, ...rest } = lastAction.data;
      await supabase.from("saidas").update(rest).eq("id", id);
    }

    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    setLastAction(null);
    setCopied(false);
  };

  const filteredExpenses = useMemo(() => {
    let result = [...expenses];

    // Period Filter
    if (periodFilter === "diario") {
      const todayStr = format(selectedDate, "yyyy-MM-dd");
      result = result.filter(e => e.vencimento === todayStr);
    } else if (periodFilter === "semanal") {
      const start = startOfWeek(selectedDate);
      const end = endOfWeek(selectedDate);
      result = result.filter(e => {
        const d = parseISO(e.vencimento);
        return isWithinInterval(d, { start, end });
      });
    } else if (periodFilter === "mensal") {
      const start = startOfMonth(selectedDate);
      const end = endOfMonth(selectedDate);
      result = result.filter(e => {
        const d = parseISO(e.vencimento);
        return isWithinInterval(d, { start, end });
      });
    }

    // Search Filter
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(e => 
        e.descricao?.toLowerCase().includes(s) || 
        e.cartao?.toLowerCase().includes(s)
      );
    }

    // Filter by Status
    const today = new Date().toISOString().split("T")[0];
    if (statusFilter === "PAGO") {
      result = result.filter(e => e.paga);
    } else if (statusFilter === "A VENCER") {
      result = result.filter(e => !e.paga && e.vencimento >= today);
    } else if (statusFilter === "VENCIDO") {
      result = result.filter(e => !e.paga && e.vencimento < today);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortField === "vencimento_asc") return a.vencimento.localeCompare(b.vencimento);
      if (sortField === "vencimento_desc") return b.vencimento.localeCompare(a.vencimento);
      if (sortField === "valor_asc") return (a.valor || 0) - (b.valor || 0);
      if (sortField === "valor_desc") return (b.valor || 0) - (a.valor || 0);
      if (sortField === "descricao_asc") return (a.descricao || "").localeCompare(b.descricao || "");
      return 0;
    });

    return result;
  }, [expenses, periodFilter, searchTerm, statusFilter, sortField, selectedDate]);

  const stats = useMemo(() => {
    const paid = filteredExpenses.filter(e => e.paga).reduce((acc, e) => acc + (e.valor || 0), 0);
    const pending = filteredExpenses.filter(e => !e.paga).reduce((acc, e) => acc + (e.valor || 0), 0);
    return { paid, pending, total: paid + pending };
  }, [filteredExpenses]);

  // Mutations
  const handleTogglePaid = (expense: any) => {
    const isPaid = !expense.paga;
    updateMutation.mutate({
      id: expense.id,
      data: {
        paga: isPaid,
        data_pagamento: isPaid ? new Date().toISOString().split("T")[0] : null,
      }
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Excluir esta conta permanentemente?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenModal = (expense = null) => {
    setEditingExpense(expense || {
      vencimento: format(new Date(), "yyyy-MM-dd"),
      data_compra: format(new Date(), "yyyy-MM-dd"),
      descricao: "",
      valor: 0,
      valor_total: 0,
      paga: false,
      cartao: "DINHEIRO",
      parcela: "1/1"
    });
    setIsModalOpen(true);
  };

  if (loadingExpenses) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-8 pb-32 space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto min-h-screen">
      {/* Header Selectors */}
      <div className="flex flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0">
            <button onClick={() => handleDayChange(-1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronLeft size={14} /></button>
            <PremiumSelector value={selectedDate.getDate()} options={dayOptions} onSelect={handleDaySelect} className="bg-transparent !px-2 !py-1.5 w-[85px]" />
            <button onClick={() => handleDayChange(1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronRight size={14} /></button>
          </div>
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0"><PremiumSelector value={selectedDate.getMonth() + 1} options={monthOptions} onSelect={handleMonthSelect} className="bg-transparent !px-3 !py-1.5 min-w-[70px]" /></div>
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0"><PremiumSelector value={selectedDate.getFullYear()} options={yearOptions} onSelect={handleYearSelect} className="bg-transparent !px-3 !py-1.5 min-w-[55px]" /></div>
          
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
          <h1 className="text-sm font-black text-brand-primary italic tracking-tighter opacity-80 uppercase font-display">SAÍDAS & GESTÃO</h1>
        </div>
      </div>

      {/* Header & KPIs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mt-4">
        <div>
          <h2 className="text-text-primary text-3xl font-bold italic uppercase">Saídas</h2>
          <p className="text-text-secondary text-sm mt-1">Controle Financeiro</p>
          <div className="flex items-center gap-2 mt-4">
            <div className="flex bg-surface-section/50 rounded-xl p-0.5 border-none">
              {["diario", "semanal", "mensal", "total"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodFilter(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border-none",
                    periodFilter === p ? "bg-brand-primary text-surface-page" : "text-text-muted hover:text-white"
                  )}
                >
                  {p === "diario" ? "Dia" : p === "semanal" ? "Semana" : p === "mensal" ? "Mês" : "Total"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <div className="bg-white/5 px-6 py-3 rounded-2xl flex flex-col justify-center border-none">
            <span className="text-[9px] font-black uppercase text-text-muted tracking-tighter">Total Pago</span>
            <span className="text-lg font-black text-text-muted">
              R$ {stats.paid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-brand-primary/10 px-6 py-3 rounded-2xl flex flex-col justify-center border-none">
            <span className="text-[9px] font-black uppercase text-brand-primary/60 tracking-tighter">Total a Pagar</span>
            <span className="text-lg font-black text-brand-primary">
              R$ {stats.pending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="bg-brand-primary text-surface-page px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-brand-primary/10 border-none"
          >
            <Plus size={16} /> Nova Conta
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-surface-section/30 p-4 rounded-[1.5rem] border-none shadow-2xl">
        <div className="flex-1 min-w-[240px] relative group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-primary transition-colors" size={16} />
          <input
            type="text"
            placeholder="Buscar por descrição ou cartão..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-page/50 border-none pl-12 pr-4 h-11 rounded-2xl outline-none focus:bg-surface-page/80 transition-all font-bold text-xs uppercase text-white shadow-inner"
          />
        </div>
        <div className="flex gap-2">
          <PremiumSelector
            value={statusFilter}
            options={[
              { value: "TODOS", label: "Todos os Status" },
              { value: "PAGO", label: "Pago" },
              { value: "A VENCER", label: "A Vencer" },
              { value: "VENCIDO", label: "Vencido" },
            ]}
            onSelect={setStatusFilter}
            className="bg-surface-page/50"
          />
          <PremiumSelector
            value={sortField}
            options={[
              { value: "vencimento_asc", label: "Data (Antiga)" },
              { value: "vencimento_desc", label: "Data (Recente)" },
              { value: "valor_asc", label: "Valor (Menor)" },
              { value: "valor_desc", label: "Valor (Maior)" },
              { value: "descricao_asc", label: "Descrição (A-Z)" },
            ]}
            onSelect={setSortField}
            className="bg-surface-page/50"
          />
        </div>
        {(searchTerm || statusFilter !== "TODOS") && (
          <button 
            onClick={() => { setSearchTerm(""); setStatusFilter("TODOS"); }}
            className="text-[10px] font-black text-text-muted uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2 px-2 border-none"
          >
            <XCircle size={14} /> Limpar
          </button>
        )}
      </div>

      {/* Desktop Table Header */}
      {/* Desktop Table Header */}
      <div className="hidden md:grid md:grid-cols-[100px_120px_1fr_100px_100px_100px_80px] bg-white/[0.02] border-none text-[10px] font-black text-text-secondary uppercase tracking-widest px-6 py-5 items-center rounded-t-[2rem]">
        <div>Vencimento</div>
        <div>Cartão</div>
        <div>Descrição</div>
        <div className="text-center">Valor</div>
        <div className="text-center">Status</div>
        <div className="text-center">Pago em</div>
        <div className="text-right pr-4">Ações</div>
      </div>

      {/* Table Body */}
      <div className="space-y-1 md:space-y-0 md:bg-surface-section/30 md:rounded-b-[2rem] border-none overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-text-muted uppercase text-[10px] font-black tracking-widest italic">
            Nenhuma conta registrada
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <div key={expense.id}>
              {/* Desktop Row */}
              <div className="hidden md:grid md:grid-cols-[100px_120px_1fr_100px_100px_100px_80px] items-center px-6 py-3 transition-colors group relative border-none hover:bg-white/[0.02]">
                {/* Vencimento */}
                <div className="text-xs font-bold text-text-primary/80">
                  <InlineInput
                    type="date"
                    value={expense.vencimento || ""}
                    onSave={(v) => {
                      if (v) updateMutation.mutate({ id: expense.id, data: { vencimento: v } });
                    }}
                    className="px-0 bg-transparent hover:bg-transparent"
                  />
                </div>

                {/* Cartao */}
                <div className="min-w-0">
                  <InlineInput
                    value={expense.cartao || "DINHEIRO"}
                    onSave={(v) => updateMutation.mutate({ id: expense.id, data: { cartao: v.toUpperCase() } })}
                    className="text-[10px] font-black text-brand-primary uppercase tracking-tight px-0 bg-transparent hover:bg-transparent truncate"
                  />
                </div>

                {/* Descricao */}
                <div className="min-w-0">
                  <InlineInput
                    value={expense.descricao || ""}
                    onSave={(v) => updateMutation.mutate({ id: expense.id, data: { descricao: v.toUpperCase() } })}
                    className="font-bold text-sm text-text-primary uppercase truncate px-0 bg-transparent hover:bg-transparent"
                  />
                </div>

                {/* Valor */}
                <div className="text-center font-bold text-sm text-brand-primary/90">
                  <InlineInput
                    type="number"
                    prefix="R$"
                    value={expense.valor?.toFixed(2) || "0.00"}
                    onSave={(v) => updateMutation.mutate({ id: expense.id, data: { valor: parseFloat(v) || 0 } })}
                    className="px-0 bg-transparent hover:bg-transparent justify-center"
                  />
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  {(() => {
                    const today = new Date().toISOString().split("T")[0];
                    const isOverdue = !expense.paga && expense.vencimento < today;
                    const displayStatus = expense.paga ? "PAGO" : (isOverdue ? "VENCIDO" : "A VENCER");
                    
                    return (
                      <PremiumSelector
                        value={displayStatus}
                        options={[
                          { value: "PAGO", label: "PAGO" },
                          { value: "A VENCER", label: "A VENCER" },
                          { value: "VENCIDO", label: "VENCIDO" },
                        ]}
                        onSelect={(val) => {
                          if (val === "PAGO") {
                            if (!expense.paga) handleTogglePaid(expense);
                          } else {
                            if (expense.paga) handleTogglePaid(expense);
                          }
                        }}
                        className={cn(
                          "bg-transparent !px-2 !py-1 min-w-[95px] text-[8px] font-black tracking-widest border-none transition-all",
                          expense.paga ? "!text-white/30" : (isOverdue ? "!text-rose-500 !bg-rose-500/10 !rounded-lg" : "!text-brand-primary")
                        )}
                      />
                    );
                  })()}
                </div>

                {/* Pago em */}
                <div className="text-center text-[11px] font-bold text-text-secondary italic">
                  <InlineInput
                    type="date"
                    value={expense.data_pagamento || ""}
                    onSave={(v) => {
                      if (!v) {
                        updateMutation.mutate({ id: expense.id, data: { data_pagamento: null, paga: false } });
                      } else {
                        updateMutation.mutate({ id: expense.id, data: { data_pagamento: v, paga: true } });
                      }
                    }}
                    className="px-0 bg-transparent hover:bg-transparent justify-center italic"
                  />
                </div>

                {/* Ações */}
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(expense)} className="w-8 h-8 rounded-xl bg-white/5 text-text-secondary hover:bg-brand-primary hover:text-surface-page transition-all flex items-center justify-center border-none">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(expense.id)} className="w-8 h-8 rounded-xl bg-white/5 text-rose-500/50 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border-none">
                    <Trash2 size={14} />
                   </button>
                </div>
              </div>

              {/* Mobile Row - Agenda Style */}
              <div className="md:hidden grid grid-cols-[60px_1fr_100px] gap-4 items-center px-6 py-4 bg-surface-section/40 rounded-2xl mx-1 my-1 border-none relative">
                <div className="text-[13px] text-text-primary font-bold">
                  {expense.vencimento ? format(parseISO(expense.vencimento), "dd/MM") : "--/--"}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-black truncate uppercase text-white">
                    {expense.descricao}
                  </div>
                  <div className="text-[9px] font-black text-brand-primary/60 uppercase tracking-widest truncate">
                    {expense.cartao || "DINHEIRO"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-[13px] font-black text-brand-primary">
                    R$ {expense.valor?.toFixed(2)}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleTogglePaid(expense)} className={cn(
                      "text-[8px] font-black uppercase tracking-tighter",
                      expense.paga ? "text-white/20" : "text-brand-primary animate-pulse"
                    )}>
                      {expense.paga ? "PAGO" : "PENDER"}
                    </button>
                    <button onClick={() => handleOpenModal(expense)} className="text-text-muted"><Edit2 size={12} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense?.id ? "Editar Registro" : "Nova Conta"}
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const data: any = {
            vencimento: formData.get("vencimento"),
            data_compra: formData.get("data_compra"),
            descricao: String(formData.get("descricao")).toUpperCase(),
            valor: parseFloat(String(formData.get("valor"))) || 0,
            valor_total: parseFloat(String(formData.get("valor_total"))) || 0,
            cartao: String(formData.get("cartao")).toUpperCase(),
            parcela: formData.get("parcela"),
            paga: formData.get("paga") === "on",
          };
          if (editingExpense?.id) data.id = editingExpense.id;
          if (data.paga && !editingExpense?.paga) {
            data.data_pagamento = new Date().toISOString().split("T")[0];
          }
          saveMutation.mutate(data);
        }} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Origem/Cartão</label>
              <AutocompleteInput
                value={editingExpense?.cartao || ""}
                onChange={(v) => setEditingExpense((prev: any) => ({ ...prev, cartao: v }))}
                suggestions={cards.map(c => ({ id: c.nome, label: c.nome, value: c.nome }))}
                onSelect={(v) => setEditingExpense((prev: any) => ({ ...prev, cartao: v.label }))}
                placeholder="DINHEIRO, CARTÃO..."
                className="bg-surface-page/50 border-none"
              />
              <input type="hidden" name="cartao" value={editingExpense?.cartao || ""} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Data Compra</label>
              <input type="date" name="data_compra" defaultValue={editingExpense?.data_compra} className="w-full bg-surface-page/50 border-none p-3.5 rounded-2xl outline-none font-bold text-xs" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Descrição</label>
            <input name="descricao" required defaultValue={editingExpense?.descricao} placeholder="EX: ALUGUEL, DESPESA..." className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black uppercase text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Valor Total</label>
              <input type="number" name="valor_total" step="0.01" defaultValue={editingExpense?.valor_total} className="w-full bg-surface-page/50 border-none p-3.5 rounded-2xl outline-none font-black text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Parcela</label>
              <input name="parcela" defaultValue={editingExpense?.parcela} className="w-full bg-surface-page/50 border-none p-3.5 rounded-2xl outline-none font-black text-xs text-center" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Vencimento</label>
              <input type="date" name="vencimento" required defaultValue={editingExpense?.vencimento} className="w-full bg-surface-page/50 border-none p-3.5 rounded-2xl outline-none font-black text-xs" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Valor Parcela (R$)</label>
            <input type="number" name="valor" step="0.01" required defaultValue={editingExpense?.valor} className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black text-lg text-brand-primary" />
          </div>

          <div className="flex items-center gap-3 p-4 bg-surface-page/30 rounded-2xl">
            <input type="checkbox" name="paga" id="paga" defaultChecked={editingExpense?.paga} className="w-5 h-5 rounded bg-surface-section border-none text-brand-primary" />
            <label htmlFor="paga" className="text-[10px] font-black uppercase text-text-muted tracking-widest">Marcar como Pago</label>
          </div>

          <button type="submit" disabled={saveMutation.isPending} className="w-full bg-brand-primary text-surface-page font-black py-4 rounded-2xl border-none uppercase tracking-widest text-xs shadow-xl shadow-brand-primary/10 transition-all active:scale-[0.98]">
            {saveMutation.isPending ? "Salvando..." : editingExpense?.id ? "Salvar Alterações" : "Ativar Lançamento"}
          </button>
        </form>
      </Modal>

      {/* Alerta de Sucesso - FIXED BOTTOM */}
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
              
              {lastAction && (
                <button 
                  onClick={handleUndo}
                  className="ml-auto bg-brand-primary text-black h-10 px-4 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all border-none"
                >
                  <RotateCcw size={14} strokeWidth={3} /> Rebobinar
                </button>
              )}
            </div>
            {copiedSlots.length > 0 && (
              <div className="mt-4 bg-[#0c0c0e] rounded-[1rem] py-2.5 px-4 border border-white/5 shadow-inner">
                 <p className="text-[9px] font-black text-white/70 tracking-[0.1em] text-center whitespace-nowrap overflow-hidden text-ellipsis">
                  {copiedSlots.join(" - ")}
                 </p>
              </div>
            )}
            {/* Progress Bar (Contagem Regressiva) */}
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
    </div>
  );
}
