"use client";

import { useCards, useSupabase } from "@/hooks/use-data";
import { Plus, CreditCard, Trash2, Edit2, ChevronRight, Ban, Wallet, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Modal } from "@/components/shared/modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

export default function CardsPage() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: cards = [], isLoading: loadingCards } = useCards();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
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

      {/* List */}
      <div className="flex flex-col gap-3">
        {cards.length === 0 ? (
          <div className="py-20 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest opacity-20 bg-surface-section/10 rounded-[2.5rem]">
            Nenhum cartão cadastrado
          </div>
        ) : (
          cards.map((card) => (
            <Link 
              key={card.id}
              href={`/cartoes/${card.id}`}
              className="group bg-surface-section/30 hover:bg-surface-section/50 rounded-2xl p-4 transition-all duration-300 relative overflow-hidden flex items-center gap-6 border-none shadow-lg hover:shadow-xl"
            >
              {/* Visual Anchor */}
              <div className="w-12 h-12 rounded-xl bg-surface-page flex items-center justify-center text-brand-primary shadow-inner group-hover:scale-110 transition-transform duration-500 shrink-0">
                <CreditCard size={20} />
              </div>

              {/* Info Column */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-brand-primary transition-colors leading-tight truncate">
                  {card.nome}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{card.banco || "Instituição"}</span>
                  <span className="w-1 h-1 rounded-full bg-white/10" />
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{card.titular || "Titular"}</span>
                </div>
              </div>

              {/* Dates - Hidden on very small screens, shown as rows on mobile if needed, but keeping it clean here */}
              <div className="hidden sm:flex items-center gap-4 px-6 border-l border-white/5">
                <div className="text-right">
                   <p className="text-[8px] font-black text-text-muted uppercase tracking-[0.1em]">Fechamento</p>
                   <p className="text-xs font-black text-white">Dia {card.fechamento?.split('-')[2] || '--'}</p>
                </div>
                <div className="text-right">
                   <p className="text-[8px] font-black text-brand-primary uppercase tracking-[0.1em]">Vencimento</p>
                   <p className="text-xs font-black text-white">Dia {card.vencimento?.split('-')[2] || '--'}</p>
                </div>
              </div>

              {/* Status & Actions */}
              <div className="flex items-center gap-4">
                <div className="hidden md:block text-right px-4">
                  <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-[9px] font-black uppercase rounded-full">Ativo</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenModal(card);
                    }}
                    className="p-2 text-text-muted hover:text-white transition-colors border-none"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(card.id, e)}
                    className="p-2 text-text-muted hover:text-rose-500 transition-colors border-none"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="pl-2 group-hover:translate-x-1 transition-transform">
                  <ChevronRight size={18} className="text-text-muted" />
                </div>
              </div>
            </Link>
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
          const data: any = {
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
