import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useClients() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("clients_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useProcedures() {
  return useQuery({
    queryKey: ["procedures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedimentos")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useBarbers() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("barbers_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "barbeiros" }, () => {
        queryClient.invalidateQueries({ queryKey: ["barbers"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["barbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbeiros")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface DbAppointment {
  id: string;
  data: string;
  horario: string;
  cliente: string;
  procedimento: string | null;
  observacoes: string | null;
  valor: number | null;
  forma_pagamento: string | null;
  barbeiro_id: string | null;
  barbeiro: string | null;
  whatsapp_enviado: boolean | null;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  client: string;
  service: string;
  observations: string | null;
  value: number;
  paymentMethod: string;
  barberId: string | null;
  whatsappSent: boolean;
}

export function useAppointments() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("appointments_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agendamentos_lucas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agendamentos_joao_lucas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery<Appointment[]>({
    queryKey: ["appointments"],
    queryFn: async () => {
      const all: DbAppointment[] = [];
      let from = 0;
      const PAGE_SIZE = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("agendamentos")
          .select("*")
          .order("data", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        all.push(...(data as DbAppointment[]));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return all.map((r) => {
        let barberId = r.barbeiro_id;
        if (!barberId && r.barbeiro) {
          const bName = r.barbeiro.toLowerCase();
          if (bName === "joão lucas" || bName === "joao lucas") {
            barberId = "3";
          } else if (bName === "lucas") {
            barberId = "1";
          }
        }
        return {
          id: r.id,
          date: r.data,
          time: r.horario,
          client: r.cliente,
          service: r.procedimento || "A DEFINIR",
          observations: r.observacoes,
          value: Number(r.valor) || 0,
          paymentMethod: r.forma_pagamento || "PIX",
          barberId: barberId,
          whatsappSent: r.whatsapp_enviado || false,
        };
      });
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useSupabase() {
  return supabase;
}

export interface WaitlistItem {
  id: string;
  data: string;
  cliente_nome: string;
  sem_preferencia: boolean;
  hora_inicio: string | null;
  hora_fim: string | null;
}

export function useWaitlist(dateStr: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`waitlist_${dateStr}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lista_espera", filter: `data=eq.${dateStr}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["waitlist", dateStr] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, dateStr]);

  return useQuery<WaitlistItem[]>({
    queryKey: ["waitlist", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lista_espera")
        .select("*")
        .eq("data", dateStr)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as WaitlistItem[];
    },
    staleTime: 1000 * 30,
  });
}

