"use client";

import { useClients, useSupabase } from "@/hooks/use-data";
import { Plus, Search, Filter, Trash2, Edit2, User, Phone, MapPin, Crown, ChevronRight, XCircle, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { PremiumSelector } from "@/components/shared/premium-selector";
import { Modal } from "@/components/shared/modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: clients = [], isLoading: loadingClients } = useClients();

  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("TODOS");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const filteredClients = useMemo(() => {
    let result = [...clients];

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.nome?.toLowerCase().includes(s) || 
        c.telefone?.toLowerCase().includes(s)
      );
    }

    if (planFilter !== "TODOS") {
      result = result.filter(c => c.plano === planFilter);
    }

    return result;
  }, [clients, searchTerm, planFilter]);

  const stats = useMemo(() => {
    const vip = clients.filter(c => c.plano && c.plano !== "Nenhum").length;
    return { total: clients.length, vip };
  }, [clients]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        const { error } = await supabase.from("clientes").update(data).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setIsModalOpen(false);
      setEditingClient(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Deseja excluir este cliente e todo seu histórico?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenModal = (client = null) => {
    setEditingClient(client || {
      nome: "",
      telefone: "",
      plano: "Nenhum",
      valor_plano: 0,
      limite_cortes: 0,
      observacoes_cliente: ""
    });
    setIsModalOpen(true);
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
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl md:text-3xl font-black tracking-tight text-text-primary uppercase italic">
            Clientes <span className="text-text-secondary font-medium lowercase">({filteredClients.length})</span>
          </h2>
          <div className="flex items-center gap-3 mt-2">
             <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(212,212,216,0.5)]" />
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{stats.vip} MEMBROS VIP</span>
             </div>
          </div>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="bg-brand-primary text-surface-page px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-brand-primary/10 border-none w-full md:w-auto justify-center"
        >
          <Plus size={16} /> Cadastrar Cliente
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-surface-section/30 p-4 rounded-[1.5rem] border-none shadow-2xl">
        <div className="flex-1 min-w-[240px] relative group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-primary transition-colors" size={16} />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-page/50 border-none pl-12 pr-4 h-11 rounded-2xl outline-none focus:bg-surface-page/80 transition-all font-bold text-xs uppercase text-white shadow-inner"
          />
        </div>
        <PremiumSelector
          value={planFilter}
          options={[
            { value: "TODOS", label: "Todos os Planos" },
            { value: "Nenhum", label: "Sem Plano" },
            { value: "Mensal", label: "Plano Mensal" },
            { value: "Semestral", label: "Plano Semestral" },
            { value: "Anual", label: "Plano Anual" },
          ]}
          onSelect={setPlanFilter}
          className="bg-surface-page/50"
        />

        <div className="flex bg-surface-page/50 rounded-xl p-1 gap-1">
          <button 
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-2 rounded-lg transition-all border-none",
              viewMode === "grid" ? "bg-brand-primary text-surface-page" : "text-text-muted hover:text-white"
            )}
          >
            <LayoutGrid size={16} />
          </button>
          <button 
            onClick={() => setViewMode("list")}
            className={cn(
              "p-2 rounded-lg transition-all border-none",
              viewMode === "list" ? "bg-brand-primary text-surface-page" : "text-text-muted hover:text-white"
            )}
          >
            <List size={16} />
          </button>
        </div>

        {searchTerm && (
          <button 
            onClick={() => setSearchTerm("")}
            className="text-[10px] font-black text-text-muted uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2 px-2 border-none"
          >
            <XCircle size={14} /> Limpar
          </button>
        )}
      </div>

      {/* Grid or List View */}
      {filteredClients.length === 0 ? (
        <div className="py-20 text-center text-text-muted italic text-[10px] uppercase font-bold tracking-widest opacity-30">
          Nenhum cliente encontrado
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClients.map((client) => (
            <Link 
              key={client.id}
              href={`/clientes/${client.id}`}
              className="group bg-surface-section/30 hover:bg-surface-section/50 rounded-[1.5rem] lg:rounded-[2rem] p-4 lg:p-6 transition-all duration-500 relative overflow-hidden flex flex-col gap-3 lg:gap-4 border-none shadow-lg hover:shadow-2xl hover:-translate-y-1"
            >
              {/* Card content same as before but encapsulated */}
              {client.plano && client.plano !== "Nenhum" && (
                <div className="absolute top-4 right-4 lg:top-6 lg:right-6 text-brand-primary">
                  <Crown size={14} className="lg:w-4 lg:h-4 transition-all" strokeWidth={3} />
                </div>
              )}
              
              <div className="flex flex-col items-center gap-2 lg:gap-3 text-center">
                <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-xl lg:rounded-[1.5rem] bg-surface-page flex items-center justify-center text-xl lg:text-2xl font-black text-brand-primary shadow-xl group-hover:scale-110 transition-transform duration-500">
                  {client.nome?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-white font-black text-xs lg:text-sm uppercase tracking-tight group-hover:text-brand-primary transition-colors leading-tight">
                    {client.nome}
                  </h3>
                  <p className="text-[9px] lg:text-[10px] text-text-muted font-bold tracking-widest mt-1">
                    {client.telefone || "--"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-xl">
                  <span className="text-[8px] font-black text-text-muted uppercase">Plano</span>
                  <span className={cn(
                    "text-[9px] font-black uppercase",
                    client.plano !== "Nenhum" ? "text-brand-primary" : "text-white/20"
                  )}>
                    {client.plano || "Nenhum"}
                  </span>
                </div>
                 <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-xl">
                  <span className="text-[8px] font-black text-text-muted uppercase">Membro desde</span>
                  <span className="text-[9px] font-black text-white/40 uppercase">
                    {client.created_at ? new Date(client.created_at).getFullYear() : "--"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenModal(client);
                  }}
                  className="p-2 text-text-muted hover:text-white transition-colors border-none"
                >
                  <Edit2 size={14} />
                </button>
                <div className="flex items-center gap-1 text-[8px] font-black text-brand-primary uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                  Perfil <ChevronRight size={10} />
                </div>
                <button 
                  onClick={(e) => handleDelete(client.id, e)}
                  className="p-2 text-text-muted hover:text-rose-500 transition-colors border-none"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-surface-section/30 rounded-[1.5rem] lg:rounded-[2rem] overflow-hidden shadow-2xl">
          <div className="hidden md:grid grid-cols-[60px_1fr_180px_150px_150px_120px] gap-4 px-8 py-5 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] bg-white/[0.02]">
            <div>Avatar</div>
            <div>Nome</div>
            <div>Observações</div>
            <div>Plano</div>
            <div>Desde</div>
            <div className="text-right">Ações</div>
          </div>
          <div className="divide-y divide-white/[0.02]">
            {filteredClients.map((client) => (
              <Link 
                key={client.id}
                href={`/clientes/${client.id}`}
                className="flex flex-col md:grid md:grid-cols-[60px_1fr_180px_150px_150px_120px] gap-3 md:gap-4 px-4 md:px-8 py-3 md:py-4 items-center hover:bg-white/[0.02] transition-colors group border-none"
              >
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="w-10 h-10 rounded-xl bg-surface-page flex items-center justify-center text-brand-primary font-black text-sm shadow-lg group-hover:scale-110 transition-transform shrink-0">
                    {client.nome?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 md:hidden">
                    <h3 className="text-white font-black text-xs uppercase tracking-tight group-hover:text-brand-primary transition-colors truncate">
                      {client.nome}
                    </h3>
                  </div>
                   {/* Mobile Actions - Removed as requested */}
                </div>

                <div className="hidden md:block min-w-0">
                  <h3 className="text-white font-black text-[13px] uppercase tracking-tight group-hover:text-brand-primary transition-colors truncate">
                    {client.nome}
                  </h3>
                </div>

                <div className="hidden md:block w-full md:w-auto text-[10px] md:text-[11px] font-medium text-text-muted truncate italic px-1 md:px-0">
                  {client.observacoes_cliente || <span className="text-white/10">—</span>}
                </div>

                <div className="flex items-center md:justify-start gap-4 w-full md:w-auto px-1 md:px-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest",
                      client.plano !== "Nenhum" ? "bg-brand-primary/10 text-brand-primary" : "bg-white/5 text-white/20"
                    )}>
                      {client.plano || "Nenhum"}
                    </span>
                  </div>
                  {/* Join date - Desktop only */}
                </div>

                <div className="hidden md:block text-[11px] font-black text-text-muted uppercase tracking-widest">
                  {client.created_at ? new Date(client.created_at).getFullYear() : "--"}
                </div>

                <div className="hidden md:flex items-center justify-end gap-2">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenModal(client);
                    }}
                    className="p-2 text-text-muted hover:text-white transition-colors border-none"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(client.id, e)}
                    className="p-2 text-text-muted hover:text-rose-500 transition-colors border-none"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={14} className="text-text-muted group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClient?.id ? "Editar Cliente" : "Novo Cliente"}
      >
         <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const data: any = {
            nome: String(formData.get("nome")),
            telefone: String(formData.get("telefone")),
            plano: String(formData.get("plano")),
            valor_plano: parseFloat(String(formData.get("valor_plano"))) || 0,
            limite_cortes: parseInt(String(formData.get("limite_cortes"))) || 0,
            observacoes_cliente: String(formData.get("observacoes_cliente")),
          };
          if (editingClient?.id) data.id = editingClient.id;
          saveMutation.mutate(data);
        }} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Nome Completo</label>
            <input name="nome" required defaultValue={editingClient?.nome} className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black uppercase text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Telefone</label>
            <input name="telefone" defaultValue={editingClient?.telefone} className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-bold text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Plano Especial</label>
              <select name="plano" defaultValue={editingClient?.plano || "Nenhum"} className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black uppercase text-xs appearance-none">
                <option value="Nenhum" className="bg-surface-section">Nenhum</option>
                <option value="Mensal" className="bg-surface-section">Mensal</option>
                <option value="Semestral" className="bg-surface-section">Semestral</option>
                <option value="Anual" className="bg-surface-section">Anual</option>
                <option value="Pausado" className="bg-surface-section">Pausado</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Valor Plano (R$)</label>
              <input type="number" name="valor_plano" step="0.01" defaultValue={editingClient?.valor_plano} className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black text-sm text-brand-primary" />
            </div>
          </div>

           <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Notas Internas</label>
            <textarea name="observacoes_cliente" defaultValue={editingClient?.observacoes_cliente} className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-medium text-xs h-24 resize-none" />
          </div>

          <button type="submit" disabled={saveMutation.isPending} className="w-full bg-brand-primary text-surface-page font-black py-4 rounded-2xl border-none uppercase tracking-widest text-xs shadow-xl shadow-brand-primary/10 transition-all active:scale-[0.98]">
            {saveMutation.isPending ? "Salvando..." : editingClient?.id ? "Salvar Alterações" : "Cadastrar Cliente"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
