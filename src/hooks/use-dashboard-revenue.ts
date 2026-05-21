import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import {
  fetchDashboardRevenue,
  type ChartGranularity,
} from "@/lib/dashboard-revenue";

export function useDashboardRevenue(
  referenceDate: Date,
  chartTimeframe: string
) {
  const queryClient = useQueryClient();
  const dateStr = format(referenceDate, "yyyy-MM-dd");
  const granularity = chartTimeframe as ChartGranularity;

  useEffect(() => {
    const channel = supabase
      .channel("dashboard_revenue_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agendamentos" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["dashboard-revenue", dateStr, chartTimeframe],
    queryFn: () => fetchDashboardRevenue(referenceDate, granularity),
    staleTime: 60_000,
  });
}
