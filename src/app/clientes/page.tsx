"use client";
 
import { useClients, useSupabase } from "@/hooks/use-data";
import { Plus, Search, Filter, Trash2, Edit2, User, Phone, MapPin, Crown, ChevronRight, XCircle, LayoutGrid, List, Check, Loader2, Sparkles, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { PremiumSelector } from "@/components/shared/premium-selector";
import { Modal } from "@/components/shared/modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { InlineInput } from "@/components/shared/inline-input";

function getJaroWinklerSimilarity(s1: string, s2: string): number {
  let m = 0;
  if (s1.length === 0 || s2.length === 0) return 0;
  s1 = s1.toLowerCase().trim();
  s2 = s2.toLowerCase().trim();
  if (s1 === s2) return 1;

  const range = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  for (let i = 0; i < s1.length; i++) {
    const low = Math.max(0, i - range);
    const high = Math.min(i + range + 1, s2.length);
    for (let j = low; j < high; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        m++;
        break;
      }
    }
  }

  if (m === 0) return 0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) t++;
      k++;
    }
  }

  t = t / 2;
  const jaro = (m / s1.length + m / s2.length + (m - t) / m) / 3;
  
  let p = 0.1;
  let l = 0;
  while (s1[l] === s2[l] && l < 4) l++;
  
  return jaro + l * p * (1 - jaro);
}

function getNameSimilarity(n1: string, n2: string): number {
  if (!n1 || !n2) return 0;
  const clean1 = n1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const clean2 = n2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  if (clean1 === clean2) return 1;
  
  if (clean1.includes(clean2) || clean2.includes(clean1)) {
    const minLen = Math.min(clean1.length, clean2.length);
    const maxLen = Math.max(clean1.length, clean2.length);
    return minLen / maxLen;
  }
  
  return getJaroWinklerSimilarity(clean1, clean2);
}

function cleanPhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: clients = [], isLoading: loadingClients } = useClients();

  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("TODOS");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // State for Smart Sync
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncContacts, setSyncContacts] = useState<any[]>([]);

  // State for Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<any>(null);

  // State for Name Edit/Migration Modal
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [pendingClientData, setPendingClientData] = useState<any>(null);


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
    mutationFn: async ({ data, migrate }: { data: any; migrate?: boolean }) => {
      const cleanData = { ...data };
      if (typeof cleanData.nome === "string") {
        cleanData.nome = cleanData.nome.trimEnd();
      }

      const clientObj = cleanData.id ? clients.find(c => String(c.id) === String(cleanData.id)) : null;
      const oldName = clientObj?.nome;

      if (cleanData.id) {
        const { error } = await supabase.from("clientes").update(cleanData).eq("id", cleanData.id);
        if (error) throw error;

        if (migrate && oldName && cleanData.nome && oldName !== cleanData.nome) {
          const newName = cleanData.nome;
          await supabase.from("agendamentos_lucas").update({ cliente: newName }).ilike("cliente", oldName);
          await supabase.from("agendamentos_joao_lucas").update({ cliente: newName }).ilike("cliente", oldName);
        }
      } else {
        const { error } = await supabase.from("clientes").insert([cleanData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setIsModalOpen(false);
      setEditingClient(null);
      setIsEditNameModalOpen(false);
      setPendingClientData(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, deleteHistory }: { id: string, deleteHistory: boolean }) => {
      const clientObj = clients.find(c => String(c.id) === String(id));
      const { error: clientError } = await supabase.from("clientes").delete().eq("id", id);
      if (clientError) throw clientError;

      if (deleteHistory && clientObj?.nome) {
        const clientName = clientObj.nome;
        await supabase.from("agendamentos_lucas").delete().ilike("cliente", clientName);
        await supabase.from("agendamentos_joao_lucas").delete().ilike("cliente", clientName);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    },
    onError: (err) => {
      console.error(err);
      alert("Erro ao excluir o cliente.");
    }
  });

  const handleDelete = (client: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setClientToDelete(client);
    setIsDeleteModalOpen(true);
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

  // (removed handleStartSync and syncMutation)

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
          <h2 className="text-3xl font-black tracking-tight text-text-primary uppercase italic leading-none">
            Clientes <span className="text-text-secondary font-medium lowercase">({filteredClients.length})</span>
          </h2>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(212,212,216,0.5)]" />
            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{stats.vip} VIP</span>
          </div>
        </div>

        {/* Controls Container */}
        <div className="flex flex-wrap items-center gap-3 flex-1 xl:justify-end">
          {/* Search & Filters */}
          <div className="flex flex-wrap gap-2 items-center bg-surface-section/30 p-2 rounded-2xl border-none shadow-2xl flex-1 max-w-2xl">
            <div className="flex-1 min-w-[160px] relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-brand-primary transition-colors" size={14} />
              <input
                type="text"
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-page/50 border-none pl-9 pr-3 h-9 rounded-xl outline-none focus:bg-surface-page/80 transition-all font-bold text-[10px] uppercase text-white shadow-inner"
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
              className="bg-surface-page/50 !h-9 !py-1 !px-2 text-[9px]"
            />

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

            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="text-[9px] font-black text-text-muted uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1.5 px-2 border-none"
              >
                <XCircle size={12} /> Limpar
              </button>
            )}
          </div>

          {/* (removed Sync Button) */}

          {/* Cadastrar button as a small square next to search/filters */}
          <button
            onClick={() => handleOpenModal()}
            className="w-10 h-10 bg-brand-primary text-surface-page rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-primary/10 border-none shrink-0 cursor-pointer"
            title="Cadastrar Cliente"
          >
            <Plus size={18} />
          </button>
        </div>
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
                  onClick={(e) => handleDelete(client, e)}
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
          <div className="hidden md:grid grid-cols-[60px_1.5fr_1.2fr_1.5fr_1fr_1fr_120px] gap-0 px-8 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] bg-white/[0.02]">
            <div className="px-4">Avatar</div>
            <div className="px-4">Nome</div>
            <div className="px-4">Telefone</div>
            <div className="px-4">Observações</div>
            <div className="px-4">Plano</div>
            <div className="px-4">Desde</div>
            <div className="text-right pr-8">Ações</div>
          </div>
          <div className="divide-y divide-white/[0.02]">
            {filteredClients.map((client) => (
              <div 
                key={client.id}
                className="flex flex-col md:grid md:grid-cols-[60px_1.5fr_1.2fr_1.5fr_1fr_1fr_120px] gap-3 md:gap-0 px-4 md:px-8 py-4 md:py-0 md:h-12 items-start md:items-center hover:bg-white/[0.01] transition-colors group relative border-none focus-within:z-[500] z-[1]"
              >
                {/* Mobile Top Row: Avatar + Name + Plan Badge */}
                <div className="flex md:hidden items-center justify-between w-full gap-3">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <Link 
                      href={`/clientes/${client.id}`}
                      className="w-10 h-10 rounded-xl bg-surface-page flex items-center justify-center text-brand-primary font-black text-sm shadow-lg hover:scale-110 transition-transform shrink-0 overflow-hidden"
                    >
                      {client.foto_url ? (
                        <img 
                          src={client.foto_url} 
                          alt={client.nome} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        client.nome?.charAt(0).toUpperCase()
                      )}
                    </Link>

                    {/* Nome */}
                    <Link 
                      href={`/clientes/${client.id}`}
                      className="text-white font-black text-[13px] uppercase tracking-tight hover:text-brand-primary transition-colors truncate block max-w-[180px]"
                    >
                      {client.nome}
                    </Link>
                  </div>

                  {/* Plano */}
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                    client.plano !== "Nenhum" ? "bg-brand-primary/10 text-brand-primary" : "bg-white/5 text-white/20"
                  )}>
                    {client.plano || "Nenhum"}
                  </span>
                </div>

                {/* Desktop Grid Columns */}
                {/* 1. Avatar */}
                <div className="hidden md:flex items-center shrink-0 md:px-4">
                  <Link 
                    href={`/clientes/${client.id}`}
                    className="w-10 h-10 rounded-xl bg-surface-page flex items-center justify-center text-brand-primary font-black text-sm shadow-lg hover:scale-110 transition-transform shrink-0 overflow-hidden"
                  >
                    {client.foto_url ? (
                      <img 
                        src={client.foto_url} 
                        alt={client.nome} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      client.nome?.charAt(0).toUpperCase()
                    )}
                  </Link>
                </div>

                {/* 2. Nome */}
                <div className="hidden md:flex items-center md:px-4 min-w-0">
                  <Link 
                    href={`/clientes/${client.id}`}
                    className="text-white font-black text-[13px] uppercase tracking-tight hover:text-brand-primary transition-colors truncate block"
                  >
                    {client.nome}
                  </Link>
                </div>

                {/* 3. Telefone */}
                <div 
                  className="flex items-center md:px-4 transition-all focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand-primary relative min-w-0 w-full md:w-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <InlineInput 
                    value={client.telefone || ""}
                    placeholder="Adicionar telefone..."
                    onSave={(val) => saveMutation.mutate({ data: { id: client.id, telefone: cleanPhone(val) } })}
                    className="text-white/60 md:text-white font-bold w-full flex items-center text-xs"
                  />
                </div>

                {/* 4. Observações */}
                <div className="hidden md:flex items-center md:px-4 text-[10px] md:text-[11px] font-medium text-text-muted truncate italic">
                  {client.observacoes_cliente || <span className="text-white/10">—</span>}
                </div>

                {/* 5. Plano */}
                <div className="hidden md:flex items-center md:px-4 shrink-0">
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                    client.plano !== "Nenhum" ? "bg-brand-primary/10 text-brand-primary" : "bg-white/5 text-white/20"
                  )}>
                    {client.plano || "Nenhum"}
                  </span>
                </div>

                {/* 6. Desde */}
                <div className="hidden md:flex items-center md:px-4 text-[11px] font-black text-text-muted uppercase tracking-widest">
                  {client.created_at ? new Date(client.created_at).getFullYear() : "--"}
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end md:px-4 gap-2 w-full md:w-auto mt-1 md:mt-0 pt-2 md:pt-0 border-t border-white/5 md:border-none">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenModal(client);
                    }}
                    className="p-2 text-text-muted hover:text-white transition-colors border-none cursor-pointer shrink-0"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(client, e)}
                    className="p-2 text-text-muted hover:text-rose-500 transition-colors border-none cursor-pointer shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                  <Link href={`/clientes/${client.id}`} className="text-text-muted hover:text-brand-primary hover:translate-x-1 transition-all pl-1 shrink-0">
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
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
            telefone: cleanPhone(String(formData.get("telefone"))),
            plano: String(formData.get("plano")),
            valor_plano: parseFloat(String(formData.get("valor_plano"))) || 0,
            limite_cortes: parseInt(String(formData.get("limite_cortes"))) || 0,
            observacoes_cliente: String(formData.get("observacoes_cliente")),
          };
          if (editingClient?.id) data.id = editingClient.id;

          const oldName = editingClient?.nome;
          const newName = data.nome?.trimEnd();

          if (editingClient?.id && oldName && newName && oldName !== newName) {
            setPendingClientData(data);
            setIsEditNameModalOpen(true);
          } else {
            saveMutation.mutate({ data });
          }
        }} className="flex flex-col gap-3 py-2 w-full">
          <div className="figma-form-group">
            <label className="figma-form-label">Nome Completo</label>
            <input name="nome" required defaultValue={editingClient?.nome} className="figma-form-input uppercase font-bold" />
          </div>

          <div className="figma-form-group">
            <label className="figma-form-label">Telefone</label>
            <input name="telefone" defaultValue={editingClient?.telefone} className="figma-form-input font-bold" />
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="figma-form-group">
              <label className="figma-form-label">Plano Especial</label>
              <select name="plano" defaultValue={editingClient?.plano || "Nenhum"} className="figma-form-input font-bold uppercase appearance-none">
                <option value="Nenhum" className="bg-[#18181B]">Nenhum</option>
                <option value="Mensal" className="bg-[#18181B]">Mensal</option>
                <option value="Semestral" className="bg-[#18181B]">Semestral</option>
                <option value="Anual" className="bg-[#18181B]">Anual</option>
                <option value="Pausado" className="bg-[#18181B]">Pausado</option>
              </select>
            </div>
            <div className="figma-form-group">
              <label className="figma-form-label">Valor Plano (R$)</label>
              <input type="number" name="valor_plano" step="0.01" defaultValue={editingClient?.valor_plano} className="figma-form-input font-bold" />
            </div>
          </div>

           <div className="figma-form-group">
            <label className="figma-form-label">Notas Internas</label>
            <textarea name="observacoes_cliente" defaultValue={editingClient?.observacoes_cliente} className="figma-form-textarea font-medium" />
          </div>

          <button type="submit" disabled={saveMutation.isPending} className="figma-form-button-save border-none">
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </Modal>

      {/* (removed Sincronização Inteligente Modal) */}
      
      {/* Delete Client Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setClientToDelete(null);
        }}
        title="Excluir Cliente"
      >
        <div className="flex flex-col gap-4 py-1 text-center">
          <p className="text-[11px] font-bold text-text-secondary leading-normal">
            Deseja mesmo excluir o cliente <span className="text-white font-black uppercase">"{clientToDelete?.nome}"</span>?
          </p>

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => deleteMutation.mutate({ id: clientToDelete.id, deleteHistory: true })}
              disabled={deleteMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir Cliente e Apagar Todo Histórico"}
            </button>
            
            <button
              onClick={() => deleteMutation.mutate({ id: clientToDelete.id, deleteHistory: false })}
              disabled={deleteMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              Apenas Excluir Cadastro (Manter Histórico)
            </button>

            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setClientToDelete(null);
              }}
              className="w-full py-2 bg-transparent text-text-muted hover:text-white text-[9px] font-black uppercase tracking-wider border-none cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Name Migration Confirm Modal */}
      <Modal
        isOpen={isEditNameModalOpen}
        onClose={() => {
          setIsEditNameModalOpen(false);
          setPendingClientData(null);
        }}
        title="Atualizar Nome e Histórico"
      >
        <div className="flex flex-col gap-4 py-1 text-center">
          <p className="text-[11px] font-bold text-text-secondary leading-normal">
            Você está alterando o nome de <span className="text-white font-black uppercase">"{editingClient?.nome}"</span> para <span className="text-white font-black uppercase">"{pendingClientData?.nome}"</span>.
            <br />
            Deseja migrar todo o histórico de agendamentos antigos para o novo nome?
          </p>

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => saveMutation.mutate({ data: pendingClientData, migrate: true })}
              disabled={saveMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-brand-primary text-surface-page text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              {saveMutation.isPending ? "Salvando..." : "Sim, Salvar e Migrar Histórico"}
            </button>
            
            <button
              onClick={() => saveMutation.mutate({ data: pendingClientData, migrate: false })}
              disabled={saveMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer"
            >
              Apenas Mudar Nome (Manter Histórico Separado)
            </button>

            <button
              onClick={() => {
                setIsEditNameModalOpen(false);
                setPendingClientData(null);
              }}
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
