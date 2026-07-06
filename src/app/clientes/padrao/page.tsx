"use client";

import { useSupabase, useClients } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import Link from "next/link";
import { InlineAutocomplete } from "@/components/shared/inline-autocomplete";
import { User, Plus } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/shared/modal";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";

export default function ClientesPadraoPage() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: clients = [] } = useClients();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDay, setModalDay] = useState("Segunda-feira");
  const [modalTime, setModalTime] = useState("08:00");
  const [modalClientName, setModalClientName] = useState("");

  const handleOpenModal = (dayKey: string) => {
    setModalDay(dayKey);
    if (rowTimes.length > 0 && !rowTimes.includes(modalTime)) {
      setModalTime(rowTimes[0]);
    }
    setModalClientName("");
    setIsModalOpen(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = modalClientName.trim();
    if (!trimmed) return;
    createPresetMutation.mutate({ time: modalTime, day: modalDay, clientName: trimmed });
    setIsModalOpen(false);
    setModalClientName("");
  };

  const clientSuggestions = useMemo(() => {
    return clients.map((c: any) => ({
      id: String(c.id),
      label: c.nome,
      subLabel: c.telefone || undefined,
      value: String(c.id)
    }));
  }, [clients]);

  // Fetch all presets from clientes_padrao table
  const { data: presets = [], isLoading: loadingPresets } = useQuery({
    queryKey: ["clientes_padrao_presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes_padrao")
        .select("*, clientes(nome)")
        .order("horario", { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const updateNameMutation = useMutation({
    mutationFn: async ({ id, presetId, newName, oldName }: { id: string; presetId: number; newName: string; oldName: string }) => {
      const trimmed = newName.trim();
      
      // If the name is cleared, delete the preset from this slot!
      if (!trimmed) {
        const { error } = await supabase
          .from("clientes_padrao")
          .delete()
          .eq("id", presetId);
        if (error) throw error;
        return;
      }

      if (trimmed === oldName) return;

      // 1. Find or create client for newName
      let { data: client, error: findError } = await supabase
        .from("clientes")
        .select("id")
        .ilike("nome", trimmed)
        .maybeSingle();
        
      if (findError) throw findError;
      
      let clientId = client?.id;
      if (!clientId) {
        const { data: newClient, error: createError } = await supabase
          .from("clientes")
          .insert([{ nome: trimmed, plano: "Nenhum" }])
          .select("id")
          .single();
          
        if (createError) throw createError;
        clientId = newClient.id;
      }

      // 2. Update client_id in clientes_padrao
      const { error } = await supabase
        .from("clientes_padrao")
        .update({ cliente_id: clientId })
        .eq("id", presetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes_padrao_presets"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    }
  });

  const handleSaveClientName = (id: string, presetId: number, oldName: string, newName: string) => {
    updateNameMutation.mutate({ id, presetId, newName, oldName });
  };

  const createPresetMutation = useMutation({
    mutationFn: async ({ time, day, clientName }: { time: string; day: string; clientName: string }) => {
      const trimmed = clientName.trim();
      if (!trimmed) return;

      // 1. Find or create client
      let { data: client, error: findError } = await supabase
        .from("clientes")
        .select("id")
        .ilike("nome", trimmed)
        .maybeSingle();
        
      if (findError) throw findError;
      
      let clientId = client?.id;
      if (!clientId) {
        const { data: newClient, error: createError } = await supabase
          .from("clientes")
          .insert([{ nome: trimmed, plano: "Nenhum" }])
          .select("id")
          .single();
          
        if (createError) throw createError;
        clientId = newClient.id;
      }
      
      // 2. Insert into clientes_padrao
      const { error: insertError } = await supabase
        .from("clientes_padrao")
        .insert([{
          cliente_id: clientId,
          dia_semana: day,
          horario: time,
          barbeiro_id: 1
        }]);
        
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes_padrao_presets"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    }
  });

  const handleSaveNewPreset = (time: string, day: string, clientName: string) => {
    createPresetMutation.mutate({ time, day, clientName });
  };

  const getClientName = (p: any) => {
    if (!p) return "";
    const clientObj = p.clientes || p.cliente;
    if (!clientObj) return "";
    if (Array.isArray(clientObj)) {
      return clientObj[0]?.nome || "";
    }
    return clientObj.nome || "";
  };

  const weekdays = useMemo(() => [
    { key: "Segunda-feira", label: "SEG" },
    { key: "Terça-feira", label: "TER" },
    { key: "Quarta-feira", label: "QUA" },
    { key: "Quinta-feira", label: "QUI" },
    { key: "Sexta-feira", label: "SEX" },
    { key: "Sábado", label: "SÁB" },
    { key: "Domingo", label: "DOM" }
  ], []);

  const rowTimes = useMemo(() => {
    const dayStartMin = 7 * 60 + 20; // 07:20
    const dayEndMin = 20 * 60 + 40;  // 20:40
    const slotDuration = 40;
    const timesSet = new Set<string>();
    
    let currentMin = dayStartMin;
    while (currentMin <= dayEndMin) {
      if (currentMin >= 12 * 60 && currentMin < 13 * 60) {
        currentMin = 13 * 60;
        continue;
      }
      const h = Math.floor(currentMin / 60);
      const m = currentMin % 60;
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      timesSet.add(timeStr);
      currentMin += slotDuration;
    }

    // Add any custom times from presets that don't match standard slots
    presets.forEach((p: any) => {
      if (p.horario) {
        const clean = p.horario.substring(0, 5).trim();
        if (/^\d{2}:\d{2}$/.test(clean)) {
          timesSet.add(clean);
        }
      }
    });
    
    return Array.from(timesSet).sort((a, b) => a.localeCompare(b));
  }, [presets]);

  const getClientsForSlot = (time: string, day: string) => {
    return presets.filter((p: any) => {
      if (!p.dia_semana || !p.horario) return false;
      const cleanTime = p.horario.substring(0, 5).trim();
      return p.dia_semana.toLowerCase() === day.toLowerCase() && cleanTime === time;
    });
  };

  if (loadingPresets) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-page">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 sm:px-8 sm:pt-6 space-y-6 animate-in fade-in duration-500 pb-32 max-w-7xl mx-auto">
      <div className="w-full overflow-x-auto custom-scroll rounded-2xl bg-surface-page/20 p-2 shadow-2xl">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-section/60 rounded-xl">
              <th className="py-2 px-3 text-[10px] font-black text-text-secondary uppercase tracking-widest text-center rounded-l-xl">Horário</th>
              {weekdays.map((day, idx) => (
                <th 
                  key={day.key} 
                  onClick={() => handleOpenModal(day.key)}
                  className={cn(
                    "py-2 px-3 text-[10px] font-black text-text-secondary uppercase tracking-widest text-center group cursor-pointer hover:bg-surface-subtle/40 transition-colors select-none",
                    idx === weekdays.length - 1 && "rounded-r-xl"
                  )}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{day.label}</span>
                    <Plus size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-primary stroke-[3]" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {rowTimes.map((time, rowIdx) => {
              return (
                <tr 
                  key={time} 
                  className={cn(
                    "transition-colors hover:bg-surface-subtle/30",
                    rowIdx % 2 === 0 ? "bg-surface-section/10" : "bg-transparent"
                  )}
                >
                  {/* Time column */}
                  <td className="py-1.5 px-3 text-[11px] font-black text-brand-primary tracking-wider text-center bg-surface-section/25 rounded-l-xl select-none">
                    {time}
                  </td>
                  
                  {/* Weekdays columns */}
                  {weekdays.map((day, colIdx) => {
                    const slotClients = getClientsForSlot(time, day.key);
                    const isLastCol = colIdx === weekdays.length - 1;
                    return (
                      <td 
                        key={day.key} 
                        className={cn(
                          "p-0 text-center align-middle min-w-[125px] max-w-[160px] h-full",
                          isLastCol && "rounded-r-xl"
                        )}
                      >
                        {slotClients.length > 0 ? (
                          <div className="w-full h-full min-h-[36px] flex flex-col gap-1 justify-center p-1.5 focus-within:ring-2 focus-within:ring-brand-primary/60 transition-all rounded-lg">
                            {slotClients.map(c => (
                              <div
                                key={c.id}
                                className="flex items-center justify-center w-full relative group px-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <InlineAutocomplete
                                  value={getClientName(c)}
                                  suggestions={clientSuggestions}
                                  onSave={(val) => handleSaveClientName(c.cliente_id, c.id, getClientName(c), val)}
                                  className="text-[10px] text-white font-black leading-none uppercase text-center flex-1 cursor-text min-w-0 !border-none !ring-0 !bg-transparent !justify-center"
                                />
                                <Link
                                  href={`/clientes/${c.cliente_id}`}
                                  className="absolute right-1 text-white/40 hover:text-white shrink-0 border-none flex items-center justify-center p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Ver Perfil"
                                >
                                  <User size={10} strokeWidth={3} />
                                </Link>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="w-full h-full min-h-[36px] flex items-center justify-center p-1.5 focus-within:ring-2 focus-within:ring-brand-primary/60 transition-all rounded-lg">
                            <InlineAutocomplete
                              value=""
                              placeholder="+"
                              suggestions={clientSuggestions}
                              onSave={(val) => handleSaveNewPreset(time, day.key, val)}
                              className="text-[10px] text-white/5 hover:text-white/30 font-black text-center w-full justify-center transition-all cursor-pointer select-none py-1 rounded !border-none !ring-0 !bg-transparent !justify-center"
                            />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Adicionar Cliente Padrão"
        subtitle="Defina o nome, horário e dia da semana"
        icon={<Plus size={20} strokeWidth={3} />}
        className="w-full max-w-md bg-surface-card backdrop-blur-md p-6 rounded-2xl border-none shadow-2xl flex flex-col gap-4 text-left"
      >
        <form onSubmit={handleModalSubmit} className="space-y-4 pt-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
              Nome do Cliente
            </label>
            <AutocompleteInput
              value={modalClientName}
              onChange={setModalClientName}
              onSelect={(item) => setModalClientName(item.label)}
              suggestions={clientSuggestions}
              placeholder="Digite ou selecione o nome..."
              inputClassName="w-full bg-surface-subtle border-none rounded-xl px-4 py-2.5 text-sm text-text-primary focus:ring-1 focus:ring-brand-primary placeholder:text-text-muted outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                Horário
              </label>
              <select
                value={modalTime}
                onChange={(e) => setModalTime(e.target.value)}
                className="w-full bg-surface-subtle border-none rounded-xl px-4 py-2.5 text-sm text-text-primary focus:ring-1 focus:ring-brand-primary appearance-none cursor-pointer outline-none"
              >
                {rowTimes.map((t) => (
                  <option key={t} value={t} className="bg-surface-section text-text-primary">
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                Dia da Semana
              </label>
              <select
                value={modalDay}
                onChange={(e) => setModalDay(e.target.value)}
                className="w-full bg-surface-subtle border-none rounded-xl px-4 py-2.5 text-sm text-text-primary focus:ring-1 focus:ring-brand-primary appearance-none cursor-pointer outline-none"
              >
                {weekdays.map((d) => (
                  <option key={d.key} value={d.key} className="bg-surface-section text-text-primary">
                    {d.key}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-text-secondary uppercase tracking-widest hover:text-white transition-colors bg-transparent border-none outline-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!modalClientName.trim() || createPresetMutation.isPending}
              className="px-4 py-2 text-xs font-black text-surface-page bg-brand-primary rounded-xl uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none outline-none"
            >
              {createPresetMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
