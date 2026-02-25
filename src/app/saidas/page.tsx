"use client";

import { useExpenses, useSupabase, useCards } from "@/hooks/use-data";
import { Plus, Search, Filter, Trash2, Edit2, RotateCcw, XCircle, Calendar, CreditCard, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PremiumSelector } from "@/components/shared/premium-selector";
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

  const selectedDate = new Date(); // In actual app, this might come from a global date filter

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

    // Status Filter
    if (statusFilter !== "TODOS") {
      const isPaid = statusFilter === "PAGO";
      result = result.filter(e => e.paga === isPaid);
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
  }, [expenses, periodFilter, searchTerm, statusFilter, sortField]);

  const stats = useMemo(() => {
    const paid = filteredExpenses.filter(e => e.paga).reduce((acc, e) => acc + (e.valor || 0), 0);
    const pending = filteredExpenses.filter(e => !e.paga).reduce((acc, e) => acc + (e.valor || 0), 0);
    return { paid, pending, total: paid + pending };
  }, [filteredExpenses]);

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
    <div className="px-4 pt-6 sm:px-8 sm:pt-6 space-y-6 animate-in fade-in duration-500 pb-32">
      {/* Header & KPIs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl md:text-3xl font-black tracking-tight text-text-primary uppercase italic">
            Saídas <span className="text-text-secondary font-medium lowercase">({periodFilter})</span>
          </h2>
          <div className="flex items-center gap-2 mt-2">
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
              { value: "PAGO", label: "Somente Pagos" },
              { value: "PENDENTE", label: "Somente Pendentes" },
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
      <div className="hidden md:grid grid-cols-[120px_130px_1fr_100px_110px_120px_80px] bg-white/[0.02] border-none text-[9px] font-black text-text-muted uppercase tracking-widest px-6 py-4 items-center rounded-t-3xl">
        <div>Vencimento</div>
        <div>Cartão/Origem</div>
        <div>Descrição</div>
        <div className="text-center">Valor</div>
        <div className="text-center">Status</div>
        <div className="text-center">Pagamento</div>
        <div className="text-right">Ações</div>
      </div>

      {/* Table Body */}
      <div className="space-y-1 md:space-y-0 md:divide-y md:divide-white/[0.02]">
        {filteredExpenses.length === 0 ? (
          <div className="px-8 py-20 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest opacity-30">
            Nenhuma conta registrada
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <div key={expense.id} className="grid grid-cols-1 md:grid-cols-[120px_130px_1fr_100px_110px_120px_80px] items-center px-4 md:px-6 py-4 md:py-3 transition-colors group bg-surface-section/20 hover:bg-surface-section/40 rounded-2xl md:rounded-none border-none">
              {/* Vencimento */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  expense.paga ? "bg-white/20" : "bg-brand-primary"
                )} />
                <InlineInput
                  type="text"
                  value={expense.vencimento ? format(parseISO(expense.vencimento), "dd/MM/yyyy") : "--"}
                  onSave={(v) => {
                    // Very simple date parse dd/mm/yyyy -> yyyy-mm-dd
                    const parts = v.split("/");
                    if (parts.length === 3) {
                      const iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
                      updateMutation.mutate({ id: expense.id, data: { vencimento: iso } });
                    }
                  }}
                  className="text-[12px] font-bold text-white px-0 bg-transparent hover:bg-transparent"
                />
              </div>

              {/* Cartao */}
              <div>
                <InlineInput
                  value={expense.cartao || "DINHEIRO"}
                  onSave={(v) => updateMutation.mutate({ id: expense.id, data: { cartao: v.toUpperCase() } })}
                  className="text-[10px] font-black text-brand-primary uppercase tracking-tight px-0 bg-transparent hover:bg-transparent"
                />
              </div>

              {/* Descricao */}
              <div>
                <InlineInput
                  value={expense.descricao || ""}
                  onSave={(v) => updateMutation.mutate({ id: expense.id, data: { descricao: v.toUpperCase() } })}
                  className="font-black text-xs text-white uppercase tracking-wider px-0 bg-transparent hover:bg-transparent"
                />
              </div>

              {/* Valor */}
              <div className="text-center">
                <InlineInput
                  type="number"
                  prefix="R$"
                  value={expense.valor?.toFixed(2) || "0.00"}
                  onSave={(v) => updateMutation.mutate({ id: expense.id, data: { valor: parseFloat(v) || 0 } })}
                  className="font-black text-[12px] text-white px-0 bg-transparent hover:bg-transparent justify-center"
                />
              </div>

              {/* Status */}
              <div className="flex justify-center">
                <button
                  onClick={() => handleTogglePaid(expense)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border-none transition-all",
                    expense.paga ? "bg-white/10 text-white/40" : "bg-brand-primary/20 text-brand-primary"
                  )}
                >
                  {expense.paga ? "PAGO" : "PENDENTE"}
                </button>
              </div>

              {/* Data Pagamento */}
              <div className="text-center text-[11px] font-bold text-text-muted">
                {expense.data_pagamento ? format(parseISO(expense.data_pagamento), "dd/MM") : "--/--"}
              </div>

              {/* Ações */}
              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenModal(expense)} className="p-2 text-text-muted hover:text-white transition-colors border-none"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(expense.id)} className="p-2 text-text-muted hover:text-rose-500 transition-colors border-none"><Trash2 size={14} /></button>
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
    </div>
  );
}
