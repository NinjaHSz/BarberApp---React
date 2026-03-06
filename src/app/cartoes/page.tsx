"use client";

import { useCards, useSupabase } from "@/hooks/use-data";
import { Plus, CreditCard, Trash2, Edit2, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/shared/modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

export default function CardsPage() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: cards = [], isLoading: loadingCards } = useCards();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Record<string, any> | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      if (data.id) {
        const { error } = await supabase.from("cartoes").update(data).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cartoes").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      setIsModalOpen(false);
      setEditingCard(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cartoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cards"] }),
  });

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Excluir este cartão permanentemente?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenModal = (card = null) => {
    setEditingCard(card || {
      nome: "",
      banco: "",
      titular: "",
      fechamento: "",
      vencimento: ""
    });
    setIsModalOpen(true);
  };

  if (loadingCards) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 sm:px-8 sm:pt-6 space-y-8 animate-in fade-in duration-500 pb-32 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl md:text-3xl font-black tracking-tight text-text-primary uppercase italic">
            Cartões <span className="text-text-secondary font-medium lowercase">({cards.length})</span>
          </h2>
          <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Gestão de Ativos e Crédito</p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="bg-brand-primary text-surface-page px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-brand-primary/10 border-none w-full md:w-auto justify-center"
        >
          <Plus size={16} /> Adicionar Cartão
        </button>
      </div>

      {/* List Header (Desktop) */}
      <div className="hidden md:grid md:grid-cols-[60px_1fr_1fr_120px_120px_100px] bg-white/[0.02] border-none text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] px-8 py-5 items-center rounded-t-[2rem]">
        <div>Ícone</div>
        <div>Cartão / Banco</div>
        <div>Titular</div>
        <div className="text-center">Fechamento</div>
        <div className="text-center">Vencimento</div>
        <div className="text-right">Ações</div>
      </div>

      {/* Cards List */}
      <div className="space-y-2 md:space-y-0 md:bg-surface-section/20 md:rounded-b-[2rem] border-none overflow-hidden">
        {cards.length === 0 ? (
          <div className="py-20 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest opacity-20 bg-surface-section/10 rounded-[2rem] md:rounded-none">
            Nenhum cartão cadastrado
          </div>
        ) : (
          cards.map((card) => (
            <div key={card.id}>
              {/* Desktop Row */}
              <Link 
                href={`/cartoes/${card.id}`}
                className="hidden md:grid md:grid-cols-[60px_1fr_1fr_120px_120px_100px] items-center px-8 py-4 transition-all duration-300 group hover:bg-white/[0.04] border-none relative"
              >
                <div className="w-10 h-10 rounded-xl bg-surface-page flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                  <CreditCard size={18} />
                </div>
                
                <div className="min-w-0 pr-4">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-brand-primary transition-colors truncate">
                    {card.nome}
                  </h3>
                  <p className="text-[9px] font-black text-text-muted uppercase tracking-widest truncate">
                    {card.banco || "Instituição"}
                  </p>
                </div>

                <div className="text-[10px] font-black text-text-secondary uppercase tracking-widest truncate">
                  {card.titular || "Geral"}
                </div>

                <div className="text-center">
                   <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black text-white/50">
                    Dia {card.fechamento?.split('-')[2] || '--'}
                   </span>
                </div>

                <div className="text-center">
                   <span className="px-3 py-1 bg-brand-primary/10 rounded-lg text-[10px] font-black text-brand-primary">
                    Dia {card.vencimento?.split('-')[2] || '--'}
                   </span>
                </div>

                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenModal(card);
                    }}
                    className="w-8 h-8 rounded-xl bg-white/5 text-text-muted hover:bg-brand-primary hover:text-surface-page transition-all flex items-center justify-center"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(card.id, e)}
                    className="w-8 h-8 rounded-xl bg-white/5 text-text-muted hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Link>

              {/* Mobile Card (Compact List Style) */}
              <Link 
                href={`/cartoes/${card.id}`}
                className="md:hidden flex items-center justify-between p-5 bg-surface-section/30 rounded-2xl mx-1 transition-all active:scale-[0.98] group border-none relative"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-surface-page flex items-center justify-center text-brand-primary shrink-0">
                    <CreditCard size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-white uppercase truncate">{card.nome}</h3>
                    <div className="flex items-center gap-2">
                       <p className="text-[9px] font-black text-text-muted uppercase tracking-widest truncate">{card.banco}</p>
                       <span className="w-1 h-1 rounded-full bg-white/10" />
                       <p className="text-[9px] font-black text-brand-primary uppercase">Dia {card.vencimento?.split('-')[2]}</p>
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-text-muted group-hover:text-brand-primary transition-colors" />
              </Link>
            </div>
          ))
        )}
      </div>


      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCard?.id ? "Editar Cartão" : "Novo Cartão"}
      >
         <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const data: Record<string, any> = {
            nome: String(formData.get("nome")).toUpperCase(),
            banco: String(formData.get("banco")).toUpperCase(),
            titular: String(formData.get("titular")).toUpperCase(),
            fechamento: formData.get("fechamento"),
            vencimento: formData.get("vencimento"),
          };
          if (editingCard?.id) data.id = editingCard.id;
          saveMutation.mutate(data);
        }} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Apelido do Cartão</label>
            <input name="nome" required defaultValue={editingCard?.nome} placeholder="EX: NUBANK PLATINUM" className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black uppercase text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Banco / Emissor</label>
              <input name="banco" defaultValue={editingCard?.banco} placeholder="EX: ITAÚ" className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black uppercase text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Nome do Titular</label>
              <input name="titular" defaultValue={editingCard?.titular} placeholder="NOME NO CARTÃO" className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black uppercase text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1 text-text-muted">Data Fechamento</label>
              <input type="date" name="fechamento" defaultValue={editingCard?.fechamento} className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black text-xs uppercase" style={{ colorScheme: "dark" }} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-brand-primary tracking-widest ml-1">Data Vencimento</label>
              <input type="date" name="vencimento" defaultValue={editingCard?.vencimento} className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black text-xs uppercase" style={{ colorScheme: "dark" }} />
            </div>
          </div>

          <button type="submit" disabled={saveMutation.isPending} className="w-full bg-brand-primary text-surface-page font-black py-4 rounded-2xl border-none uppercase tracking-widest text-xs shadow-xl shadow-brand-primary/10 transition-all active:scale-[0.98]">
            {saveMutation.isPending ? "Configurando..." : editingCard?.id ? "Atualizar Cartão" : "Ativar Cartão"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
