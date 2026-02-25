"use client";

import { useCards, useSupabase, useExpenses } from "@/hooks/use-data";
import { ChevronLeft, CreditCard, Calendar, TrendingUp, History, Info, Trash2, Edit2, Banknote, Landmark, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InlineInput } from "@/components/shared/inline-input";

export default function CardProfilePage() {
  const { id } = useParams();
  const supabase = useSupabase();
  const { data: cards = [], isLoading: loadingCards } = useCards();
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses();

  const [periodFilter, setPeriodFilter] = useState("mensal");

  const card = useMemo(() => cards.find(c => String(c.id) === id), [cards, id]);

  const cardExpenses = useMemo(() => {
    if (!card) return [];
    let result = expenses.filter(e => 
      e.cartao === card.nome || 
      e.descricao?.toUpperCase().includes(card.nome?.toUpperCase() || "")
    );

    const now = new Date();
    if (periodFilter === "diario") {
      const today = format(now, "yyyy-MM-dd");
      result = result.filter(e => e.vencimento === today);
    } else if (periodFilter === "semanal") {
      const start = startOfWeek(now);
      const end = endOfWeek(now);
      result = result.filter(e => {
        const d = parseISO(e.vencimento);
        return isWithinInterval(d, { start, end });
      });
    } else if (periodFilter === "mensal") {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      result = result.filter(e => {
        const d = parseISO(e.vencimento);
        return isWithinInterval(d, { start, end });
      });
    }

    return result.sort((a, b) => b.vencimento.localeCompare(a.vencimento));
  }, [expenses, card, periodFilter]);

  const totalSpent = useMemo(() => cardExpenses.reduce((acc, e) => acc + (e.valor || 0), 0), [cardExpenses]);

  if (loadingCards || !card) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex flex-col md:flex-row items-center gap-6 w-full">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] bg-surface-section flex items-center justify-center text-brand-primary shadow-2xl shrink-0 group hover:scale-105 transition-transform duration-500">
            <CreditCard size={40} className="group-hover:rotate-12 transition-transform duration-500" />
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
              <InlineInput
                value={card.nome}
                onSave={(v) => supabase.from("cartoes").update({ nome: v.toUpperCase() }).eq("id", id)}
                className="text-3xl md:text-5xl font-display font-black text-white p-0 uppercase tracking-tighter hover:text-brand-primary transition-colors h-auto w-auto"
              />
              <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-[9px] font-black uppercase rounded-full border-none tracking-widest">Ativo</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-center md:justify-start gap-4 md:gap-8 pt-1">
              <div className="flex items-center gap-2 group">
                <Landmark size={12} className="text-text-muted group-hover:text-brand-primary transition-colors" />
                <InlineInput
                  value={card.banco || "BANCO..."}
                  onSave={(v) => supabase.from("cartoes").update({ banco: v.toUpperCase() }).eq("id", id)}
                  className="text-[10px] font-black text-text-muted hover:text-white p-0 h-auto uppercase tracking-widest"
                />
              </div>
              <div className="flex items-center gap-2 group">
                <Target size={12} className="text-text-muted group-hover:text-brand-primary transition-colors" />
                <InlineInput
                  value={card.titular || "TITULAR..."}
                  onSave={(v) => supabase.from("cartoes").update({ titular: v.toUpperCase() }).eq("id", id)}
                  className="text-[10px] font-black text-text-muted hover:text-white p-0 h-auto uppercase tracking-widest"
                />
              </div>
            </div>
          </div>
        </div>
        <Link href="/cartoes" className="text-[9px] font-black text-text-muted hover:text-white uppercase tracking-widest flex items-center gap-2 group shrink-0">
          <ChevronLeft size={12} className="transition-transform group-hover:-translate-x-1" /> Voltar
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-section/30 p-8 rounded-[2rem] space-y-4 group">
          <div className="flex items-center gap-2 text-text-muted group-hover:text-brand-primary transition-colors">
            <Calendar size={14} />
            <p className="text-[9px] font-black uppercase tracking-widest">Fechamento</p>
          </div>
          <input 
            type="date"
            defaultValue={card.fechamento}
            onChange={(e) => supabase.from("cartoes").update({ fechamento: e.target.value }).eq("id", id)}
            className="w-full bg-surface-page/50 border-none p-4 rounded-xl outline-none font-black text-white text-sm cursor-pointer" style={{ colorScheme: "dark" }}
          />
        </div>

        <div className="bg-surface-section/30 p-8 rounded-[2rem] space-y-4 group">
          <div className="flex items-center gap-2 text-text-muted group-hover:text-brand-primary transition-colors">
            <Calendar size={14} />
            <p className="text-[9px] font-black uppercase tracking-widest">Vencimento</p>
          </div>
          <input 
            type="date"
            defaultValue={card.vencimento}
            onChange={(e) => supabase.from("cartoes").update({ vencimento: e.target.value }).eq("id", id)}
            className="w-full bg-surface-page/50 border-none p-4 rounded-xl outline-none font-black text-brand-primary text-sm cursor-pointer" style={{ colorScheme: "dark" }}
          />
        </div>

        <div className="bg-surface-section/30 p-8 rounded-[2rem] flex flex-col justify-between group h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-[64px] pointer-events-none" />
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Faturamento</p>
              <p className="text-[7px] font-black text-text-muted/50 uppercase tracking-tighter">{periodFilter === "mensal" ? "Deste Mês" : periodFilter}</p>
            </div>
            <div className="flex bg-surface-page/50 rounded-lg p-0.5 relative z-10">
              {["diario", "semanal", "mensal", "total"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodFilter(p)}
                  className={cn(
                    "px-2 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-tighter transition-all border-none",
                    periodFilter === p ? "bg-brand-primary text-surface-page shadow-lg" : "text-text-muted hover:text-white"
                  )}
                >
                  {p === "diario" ? "Dia" : p === "semanal" ? "Sem" : p === "mensal" ? "Mês" : "All"}
                </button>
              ))}
            </div>
          </div>
          <h4 className="text-3xl font-display font-black text-white mt-6 tracking-tighter relative z-10">
            R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </h4>
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-6">
        <div className="flex justify-between items-center px-4">
          <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest italic">Histórico de Gastos Vinculados</h3>
          <div className="h-px flex-1 mx-8 bg-white/5" />
          <span className="text-[9px] font-black text-text-muted">{cardExpenses.length} TRANSAÇÕES</span>
        </div>
        
        <div className="space-y-2">
          {cardExpenses.length === 0 ? (
            <div className="py-20 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest opacity-20">Nenhum gasto neste período</div>
          ) : (
            cardExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center gap-6 px-8 py-5 bg-surface-section/20 hover:bg-surface-section/40 rounded-[2rem] transition-all group border-none">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all",
                  expense.paga ? "bg-white/5 text-text-muted/40" : "bg-brand-primary/10 text-brand-primary shadow-lg shadow-brand-primary/5"
                )}>
                  {expense.paga ? <History size={16} /> : <Banknote size={16} />}
                </div>
                
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[12px] font-black text-white uppercase truncate group-hover:text-brand-primary transition-colors">{expense.descricao}</h4>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="text-[10px] font-bold text-text-muted">{format(parseISO(expense.vencimento), "dd/MM/yyyy")}</span>
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted opacity-50">
                    {expense.paga ? "Compensado no Ciclo" : "Aguardando Vencimento"}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className={cn(
                    "text-lg font-display font-black tracking-tighter",
                    expense.paga ? "text-text-muted" : "text-white"
                  )}>
                    R$ {(expense.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-widest",
                    expense.paga ? "text-brand-primary/40" : "text-rose-500/60"
                  )}>
                    {expense.paga ? "PAGO" : "PENDENTE"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
