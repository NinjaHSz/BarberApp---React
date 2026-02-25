import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useClients() {
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
