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
  });
}

export function useExpenses() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("expenses_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "saidas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saidas")
        .select("*")
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCards() {
  return useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useAppointments() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("appointments_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agendamentos" }, () => {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        date: r.data,
        time: r.horario,
        client: r.cliente,
        service: r.procedimento || "A DEFINIR",
        observations: r.observacoes,
        value: r.valor || 0,
        paymentMethod: r.forma_pagamento || "PIX",
      }));
    },
  });
}

export function useSupabase() {
  return supabase;
}
