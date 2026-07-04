"use client";

import { useSupabase, useClients } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import Link from "next/link";
import { InlineAutocomplete } from "@/components/shared/inline-autocomplete";
import { User } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

export default function ClientesPadraoPage() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: clients = [] } = useClients();

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

      const { error } = await supabase
        .from("clientes")
        .update({ nome: trimmed })
        .eq("id", id);

      if (error) throw error;

      if (oldName) {
        await supabase.from("agendamentos_lucas").update({ cliente: trimmed }).ilike("cliente", oldName);
        await supabase.from("agendamentos_joao_lucas").update({ cliente: trimmed }).ilike("cliente", oldName);
      }
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
                  className={cn(
                    "py-2 px-3 text-[10px] font-black text-text-secondary uppercase tracking-widest text-center",
                    idx === weekdays.length - 1 && "rounded-r-xl"
                  )}
                >
                  {day.label}
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
                    "transition-colors",
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
    </div>
  );
}
