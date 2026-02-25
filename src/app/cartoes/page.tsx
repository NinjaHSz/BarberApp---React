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

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.length === 0 ? (
          <div className="col-span-full py-20 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest opacity-20 border-2 border-dashed border-white/5 rounded-[2.5rem]">
            Nenhum cartão cadastrado
          </div>
        ) : (
          cards.map((card) => (
            <Link 
              key={card.id}
              href={`/cartoes/${card.id}`}
              className="group bg-surface-section/30 hover:bg-surface-section/50 rounded-[2.5rem] p-8 transition-all duration-500 relative overflow-hidden flex flex-col gap-8 border-none shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              <div className="absolute -right-12 -top-12 w-48 h-48 bg-brand-primary/5 rounded-full blur-3xl group-hover:bg-brand-primary/10 transition-all duration-700" />
              
              <div className="flex justify-between items-start">
                <div className="w-14 h-14 rounded-2xl bg-surface-page flex items-center justify-center text-brand-primary shadow-2xl group-hover:scale-110 transition-transform duration-500">
                  <CreditCard size={28} />
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">Status</p>
                  <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-[9px] font-black uppercase rounded-full border-none">Ativo</span>
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter group-hover:text-brand-primary transition-colors leading-none">
                  {card.nome}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{card.banco || "Instituição"}</span>
                  <span className="w-1 h-1 rounded-full bg-white/10" />
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{card.titular || "Titular"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="bg-white/5 p-4 rounded-2xl">
                   <p className="text-[8px] font-black text-text-muted uppercase tracking-[0.1em] mb-1">Fechamento</p>
                   <p className="text-sm font-black text-white">Dia {card.fechamento?.split('-')[2] || '--'}</p>
                </div>
                <div className="bg-brand-primary/5 p-4 rounded-2xl">
                   <p className="text-[8px] font-black text-brand-primary uppercase tracking-[0.1em] mb-1">Vencimento</p>
                   <p className="text-sm font-black text-white">Dia {card.vencimento?.split('-')[2] || '--'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
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
                <div className="flex items-center gap-1.5 text-[9px] font-black text-brand-primary uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                  Visualizar Perfil <ChevronRight size={12} />
                </div>
                <button 
                  onClick={(e) => handleDelete(card.id, e)}
                  className="p-2 text-text-muted hover:text-rose-500 transition-colors border-none"
                >
                  <Trash2 size={16} />
                </button>
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
