import { supabase } from "@/lib/supabase";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type ChartGranularity = "diario" | "semanal" | "mensal" | "anual";

export type RevenueStats = {
  day: number;
  month: number;
  year: number;
};

type AppointmentRow = {
  data: string;
  horario: string | null;
  valor: number | null;
};

const PAGE_SIZE = 1000;

export function buildChartLabels(date: Date, granularity: ChartGranularity): string[] {
  if (granularity === "diario") {
    return ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
  }
  if (granularity === "semanal") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end: addDays(start, 5) });
    return days.map((d) => format(d, "EEE", { locale: ptBR }).toUpperCase());
  }
  if (granularity === "mensal") {
    const days = eachDayOfInterval({
      start: startOfMonth(date),
      end: endOfMonth(date),
    });
    return days.map((d) => format(d, "dd"));
  }
  const months = eachMonthOfInterval({
    start: startOfYear(date),
    end: endOfYear(date),
  });
  return months.map((m) => format(m, "MMM", { locale: ptBR }).toUpperCase());
}

export function computeStatsFromRows(
  rows: AppointmentRow[],
  referenceDate: Date
): RevenueStats {
  let day = 0;
  let month = 0;
  let year = 0;

  for (const row of rows) {
    if (!row.data) continue;
    const d = parseISO(row.data);
    const v = row.valor || 0;
    if (isSameDay(d, referenceDate)) day += v;
    if (isSameMonth(d, referenceDate)) month += v;
    if (isSameYear(d, referenceDate)) year += v;
  }

  return { day, month, year };
}

export function computeChartValuesFromRows(
  rows: AppointmentRow[],
  referenceDate: Date,
  granularity: ChartGranularity
): number[] {
  const appointments = rows.map((r) => ({
    date: r.data,
    time: r.horario || "",
    value: r.valor || 0,
  }));

  if (granularity === "diario") {
    const hours = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
    return hours.map((h) => {
      const hInt = parseInt(h.split(":")[0], 10);
      return appointments
        .filter((a) => {
          if (!a.date || !a.time) return false;
          const aDate = parseISO(a.date);
          const aHour = parseInt(a.time.split(":")[0], 10);
          return isSameDay(aDate, referenceDate) && (aHour === hInt || aHour === hInt + 1);
        })
        .reduce((acc, a) => acc + (a.value || 0), 0);
    });
  }

  if (granularity === "semanal") {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end: addDays(start, 5) });
    return days.map((d) =>
      appointments
        .filter((a) => a.date && isSameDay(parseISO(a.date), d))
        .reduce((acc, a) => acc + (a.value || 0), 0)
    );
  }

  if (granularity === "mensal") {
    const days = eachDayOfInterval({
      start: startOfMonth(referenceDate),
      end: endOfMonth(referenceDate),
    });
    return days.map((d) =>
      appointments
        .filter((a) => a.date && isSameDay(parseISO(a.date), d))
        .reduce((acc, a) => acc + (a.value || 0), 0)
    );
  }

  const months = eachMonthOfInterval({
    start: startOfYear(referenceDate),
    end: endOfYear(referenceDate),
  });
  return months.map((m) =>
    appointments
      .filter((a) => a.date && isSameMonth(parseISO(a.date), m))
      .reduce((acc, a) => acc + (a.value || 0), 0)
  );
}

async function fetchAppointmentsInYear(year: number): Promise<AppointmentRow[]> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const all: AppointmentRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("agendamentos")
      .select("data, horario, valor")
      .gte("data", start)
      .lte("data", end)
      .order("data", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...(data as AppointmentRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

function isRpcMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    msg.includes("function") ||
    msg.includes("does not exist") ||
    msg.includes("could not find")
  );
}

function parseStatsPayload(data: unknown): RevenueStats | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.day !== "number" && typeof o.day !== "string") return null;
  return {
    day: Number(o.day) || 0,
    month: Number(o.month) || 0,
    year: Number(o.year) || 0,
  };
}

function parseChartPayload(data: unknown): number[] | null {
  if (!Array.isArray(data)) return null;
  return data.map((v) => Number(v) || 0);
}

export async function fetchDashboardRevenueViaRpc(
  referenceDate: Date,
  granularity: ChartGranularity
): Promise<{ stats: RevenueStats; chartValues: number[] } | null> {
  const dateStr = format(referenceDate, "yyyy-MM-dd");

  const [statsRes, chartRes] = await Promise.all([
    supabase.rpc("revenue_stats_for_date", { p_date: dateStr }),
    supabase.rpc("get_revenue_chart_series", {
      p_reference_date: dateStr,
      p_granularity: granularity,
    }),
  ]);

  if (isRpcMissing(statsRes.error) || isRpcMissing(chartRes.error)) {
    return null;
  }
  if (statsRes.error) throw statsRes.error;
  if (chartRes.error) throw chartRes.error;

  const stats = parseStatsPayload(statsRes.data);
  const chartValues = parseChartPayload(chartRes.data);
  if (!stats || !chartValues) return null;

  return { stats, chartValues };
}

export async function fetchDashboardRevenueFallback(
  referenceDate: Date,
  granularity: ChartGranularity
): Promise<{ stats: RevenueStats; chartValues: number[] }> {
  const rows = await fetchAppointmentsInYear(referenceDate.getFullYear());
  return {
    stats: computeStatsFromRows(rows, referenceDate),
    chartValues: computeChartValuesFromRows(rows, referenceDate, granularity),
  };
}

export async function fetchDashboardRevenue(
  referenceDate: Date,
  granularity: ChartGranularity
): Promise<{ stats: RevenueStats; chartValues: number[]; source: "rpc" | "fallback" }> {
  try {
    const rpc = await fetchDashboardRevenueViaRpc(referenceDate, granularity);
    if (rpc) {
      return { ...rpc, source: "rpc" };
    }
  } catch (e) {
    console.warn("[Dashboard] RPC indisponível, usando fallback paginado:", e);
  }

  const fallback = await fetchDashboardRevenueFallback(referenceDate, granularity);
  return { ...fallback, source: "fallback" };
}
