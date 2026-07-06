"use client";

import { useBarbers, useSupabase } from "@/hooks/use-data";
import { Plus, Search, Trash2, Edit2, User, XCircle, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Modal } from "@/components/shared/modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

export default function BarbersPage() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: barbers = [], isLoading: loadingBarbers } = useBarbers();

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [barberToDelete, setBarberToDelete] = useState<any | null>(null);

  const filteredBarbers = useMemo(() => {
    let result = [...barbers];

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(b => b.nome?.toLowerCase().includes(s));
    }

    return result;
  }, [barbers, searchTerm]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        nome: data.nome,
        telefone: data.telefone || null,
        ativo: data.ativo !== undefined ? data.ativo : true
      };
      if (data.id) {
        const { error } = await supabase.from("barbeiros").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("barbeiros").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barbers"] });
      setIsModalOpen(false);
      setEditingBarber(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("barbeiros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["barbers"] }),
  });

  const handleDelete = (barber: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBarberToDelete(barber);
  };

  const handleOpenModal = (barber = null) => {
    setEditingBarber(barber || { nome: "", telefone: "", ativo: true });
    setIsModalOpen(true);
  };

  if (loadingBarbers) {
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
              Barbeiros <span className="text-text-secondary font-medium lowercase">({filteredBarbers.length})</span>
            </h2>
            <p className="text-[8px] font-black text-text-muted uppercase tracking-[0.2em] mt-1">Equipe da Unidade Premium</p>
          </div>
        </div>

        {/* Controls Container */}
        <div className="flex flex-wrap items-center gap-3 flex-1 xl:justify-end">
          {/* Search & Mode Switcher */}
          <div className="flex flex-wrap gap-2 items-center bg-surface-section/30 p-2 rounded-2xl border-none shadow-2xl flex-1 max-w-xl">
            <div className="flex-1 min-w-[160px] relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-primary transition-colors" size={14} />
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-page/50 border-none pl-9 pr-3 h-9 rounded-xl outline-none focus:bg-surface-page/80 transition-all font-bold text-[10px] uppercase text-white shadow-inner"
              />
            </div>

            <div className="flex bg-surface-page/50 rounded-xl p-0.5 gap-0.5">
              <button 
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5 rounded-lg transition-all border-none", viewMode === "grid" ? "bg-brand-primary text-surface-page" : "text-text-muted hover:text-white")}
              >
                <LayoutGrid size={14} />
              </button>
              <button 
                onClick={() => setViewMode("list")}
                className={cn("p-1.5 rounded-lg transition-all border-none", viewMode === "list" ? "bg-brand-primary text-surface-page" : "text-text-muted hover:text-white")}
              >
                <List size={14} />
              </button>
            </div>
          </div>

          {/* Cadastrar button as a small square next to search/filters */}
          <button
            onClick={() => handleOpenModal()}
            className="w-10 h-10 bg-brand-primary text-surface-page rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-primary/10 border-none shrink-0 cursor-pointer"
            title="Cadastrar Barbeiro"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Barbers List */}
      {filteredBarbers.length === 0 ? (
        <div className="bg-surface-section/10 p-12 rounded-[2rem] text-center border-none shadow-xl">
          <p className="text-text-muted text-xs font-black uppercase tracking-widest">Nenhum barbeiro encontrado</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBarbers.map((barber) => (
            <div key={barber.id} className="glass-card rounded-[2rem] p-6 flex flex-col justify-between h-44 relative group">
              <Link href={`/barbeiros/${barber.id}`} className="flex items-start gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform duration-500 shadow-xl shrink-0">
                  <User size={24} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-white text-lg font-black tracking-tight uppercase truncate">{barber.nome}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[8px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-black uppercase tracking-widest inline-block">
                      Profissional
                    </span>
                    <span className={cn(
                      "text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest inline-block",
                      barber.ativo !== false ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    )}>
                      {barber.ativo !== false ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
              </Link>

              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-white/[0.02]">
                <button 
                  onClick={() => handleOpenModal(barber)}
                  className="w-9 h-9 rounded-xl bg-white/5 text-text-secondary hover:bg-brand-primary hover:text-surface-page transition-all flex items-center justify-center border-none"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={(e) => handleDelete(barber, e)}
                  className="w-9 h-9 rounded-xl bg-white/5 text-rose-500/50 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border-none"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface-section/20 rounded-[2rem] overflow-hidden shadow-2xl p-2 border-none">
          <div className="hidden md:flex items-center justify-between gap-4 px-4 py-2.5 text-[9px] font-black text-text-muted uppercase tracking-widest border-b border-white/[0.02]">
            <span>Nome do Profissional</span>
            <span className="pr-4">Ações</span>
          </div>

          <div className="divide-y divide-white/[0.02]">
            {filteredBarbers.map((barber) => (
              <div key={barber.id} className="flex items-center justify-between gap-4 px-4 py-2 hover:bg-white/[0.01] transition-colors relative group">
                <Link href={`/barbeiros/${barber.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary shrink-0">
                    <User size={14} />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-black text-white uppercase tracking-tight truncate">{barber.nome}</span>
                    <span className={cn(
                      "text-[7px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest inline-block shrink-0",
                      barber.ativo !== false ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    )}>
                      {barber.ativo !== false ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => handleOpenModal(barber)}
                    className="w-7 h-7 rounded-lg bg-white/5 text-text-secondary hover:bg-brand-primary hover:text-surface-page transition-all flex items-center justify-center border-none"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(barber, e)}
                    className="w-7 h-7 rounded-lg bg-white/5 text-rose-500/50 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border-none"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Cadastrar/Editar Barbeiro */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBarber?.id ? "Editar Barbeiro" : "Cadastrar Barbeiro"}>
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(editingBarber);
          }}
          className="flex flex-col gap-3 py-2 w-full"
        >
          <div className="figma-form-group">
            <label className="figma-form-label">Nome Completo</label>
            <input 
              type="text"
              required
              value={editingBarber?.nome || ""}
              onChange={(e) => setEditingBarber({ ...editingBarber, nome: e.target.value })}
              className="figma-form-input"
              placeholder="Digite o nome do barbeiro..."
            />
          </div>

          <div className="figma-form-group">
            <label className="figma-form-label">Telefone</label>
            <input 
              type="text"
              value={editingBarber?.telefone || ""}
              onChange={(e) => setEditingBarber({ ...editingBarber, telefone: e.target.value })}
              className="figma-form-input"
              placeholder="Digite o telefone..."
            />
          </div>

          <div className="flex items-center gap-2 py-1">
            <input 
              type="checkbox"
              id="ativo"
              checked={editingBarber?.ativo !== false}
              onChange={(e) => setEditingBarber({ ...editingBarber, ativo: e.target.checked })}
              className="rounded bg-[#27272A] border-none text-[#D4D4D8] focus:ring-0"
            />
            <label htmlFor="ativo" className="figma-form-label cursor-pointer select-none">Barbeiro Ativo</label>
          </div>

          <button 
            type="submit"
            disabled={saveMutation.isPending}
            className="figma-form-button-save border-none"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </Modal>

      {/* Delete Barber Confirmation Modal */}
      <Modal
        isOpen={!!barberToDelete}
        onClose={() => setBarberToDelete(null)}
        title="Remover Barbeiro"
      >
        <div className="flex flex-col gap-4 py-1 text-center">
          <p className="text-[11px] font-bold text-text-secondary leading-normal">
            Deseja realmente remover o barbeiro <span className="text-white font-black uppercase">"{barberToDelete?.nome}"</span>?
            <br />
            <span className="text-rose-400">Aviso:</span> Agendamentos vinculados a ele ficarão sem barbeiro definido.
          </p>

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => {
                if (barberToDelete) {
                  deleteMutation.mutate(barberToDelete.id);
                  setBarberToDelete(null);
                }
              }}
              disabled={deleteMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              {deleteMutation.isPending ? "Removendo..." : "Sim, Remover Barbeiro"}
            </button>
            <button
              onClick={() => setBarberToDelete(null)}
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
