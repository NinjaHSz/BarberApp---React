"use client";

import { useDashboardRevenue } from "@/hooks/use-dashboard-revenue";
import { buildChartLabels, type ChartGranularity } from "@/lib/dashboard-revenue";
import { LayoutDashboard, CalendarDays, TrendingUp, ArrowDownRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback, useEffect } from "react";
import { 
  format, 
  isToday, 
  isThisMonth, 
  startOfMonth, 
  endOfMonth,
  addDays,
  subDays,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { PremiumSelector } from "@/components/shared/premium-selector";
import { useAgenda } from "@/lib/contexts/agenda-context";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

function KPICard({ title, value, icon: Icon, colSpan = "" }: { title: string; value: string; icon: React.ElementType; colSpan?: string }) {
  return (
    <div className={cn(
      "bg-surface-section/30 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] group hover:bg-surface-section/50 transition-all duration-500 relative overflow-hidden",
      colSpan
    )}>
      <div className="absolute -right-4 -top-4 w-16 h-16 sm:w-24 sm:h-24 bg-brand-primary/5 rounded-full blur-2xl group-hover:bg-brand-primary/10 transition-all"></div>
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-[1.25rem] bg-brand-primary/5 flex items-center justify-center text-text-muted group-hover:scale-110 group-hover:bg-brand-primary group-hover:text-surface-page transition-all duration-500 shadow-lg shadow-brand-primary/5 shrink-0">
          <Icon size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-text-muted text-[8px] sm:text-[10px] font-black uppercase tracking-widest leading-none">{title}</p>
          <h2 className="text-text-primary text-base sm:text-2xl lg:text-3xl font-black mt-1 tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis">
            {value}
          </h2>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { selectedDate: currentDate, setSelectedDate: setCurrentDate } = useAgenda();
  const [chartTimeframe, setChartTimeframe] = useState<ChartGranularity>("mensal");
  const { data: revenueData, isLoading } = useDashboardRevenue(currentDate, chartTimeframe);

  const handleDayChange = useCallback((delta: number) => setCurrentDate(prev => delta > 0 ? addDays(prev, delta) : subDays(prev, Math.abs(delta))), [setCurrentDate]);

  // Arrow keys day-by-day navigation
  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.hasAttribute("contenteditable"))
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        handleDayChange(-1);
      } else if (e.key === "ArrowRight") {
        handleDayChange(1);
      }
    };

    window.addEventListener("keydown", handleArrowKeys);
    return () => window.removeEventListener("keydown", handleArrowKeys);
  }, [handleDayChange]);
  const handleDaySelect = useCallback((day: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setDate(day); return d; }); }, [setCurrentDate]);
  const handleMonthSelect = useCallback((month: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setMonth(month - 1); return d; }); }, [setCurrentDate]);
  const handleYearSelect = useCallback((year: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setFullYear(year); return d; }); }, [setCurrentDate]);

  const stats = revenueData?.stats ?? { day: 0, month: 0, year: 0 };

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const dayOptions = daysInMonth.map((d: Date) => ({ value: d.getDate(), label: `${format(d, 'EEE', { locale: ptBR }).toUpperCase().slice(0, 3)} ${format(d, 'dd')}` }));
  const monthOptions = [ { value: 1, label: "JAN" }, { value: 2, label: "FEV" }, { value: 3, label: "MAR" }, { value: 4, label: "ABR" }, { value: 5, label: "MAI" }, { value: 6, label: "JUN" }, { value: 7, label: "JUL" }, { value: 8, label: "AGO" }, { value: 9, label: "SET" }, { value: 10, label: "OUT" }, { value: 11, label: "NOV" }, { value: 12, label: "DEZ" } ];
  const yearOptions = useMemo(() => {
    const startYear = 2024;
    const endYear = new Date().getFullYear() + 2;
    const options = [];
    for (let y = startYear; y <= endYear; y++) {
      options.push({ value: y, label: `'${String(y).slice(-2)}` });
    }
    return options;
  }, []);

  const chartData = useMemo(() => {
    const labels = buildChartLabels(currentDate, chartTimeframe);
    const revenues = revenueData?.chartValues ?? [];

    return {
      labels,
      datasets: [
        {
          fill: true,
          label: 'Faturamento',
          data: revenues,
          borderColor: '#D4D4D8',
          backgroundColor: 'rgba(212, 212, 216, 0.1)',
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#D4D4D8',
        },
      ],
    };
  }, [revenueData?.chartValues, currentDate, chartTimeframe]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.03)',
        },
        ticks: {
          color: '#52525B', // Conforme design-system.md (--text-muted)
          font: { size: 10 },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#52525B', // Conforme design-system.md (--text-muted)
          font: { size: 10 },
        },
      },
    },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8 max-w-full overflow-x-hidden">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-text-primary text-xl font-black uppercase tracking-tighter shrink-0">LUCAS DO CORTE — PAINEL</h2>
          <div className="flex items-center gap-3">
            <p className="text-[9px] text-text-muted font-black uppercase tracking-widest shrink-0">Performance Estratégica</p>
            <button className="text-[9px] font-black text-rose-500/50 hover:text-rose-500 transition-all uppercase tracking-widest flex items-center gap-1.5 pt-0.5 shrink-0">
              <ArrowDownRight size={10} /> Relatórios
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5">
            <button onClick={() => handleDayChange(-1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronLeft size={14} /></button>
            <PremiumSelector value={currentDate.getDate()} options={dayOptions} onSelect={handleDaySelect} className="bg-transparent !px-2 !py-1.5 w-[85px]" />
            <button onClick={() => handleDayChange(1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronRight size={14} /></button>
          </div>
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5">
            <PremiumSelector value={currentDate.getMonth() + 1} options={monthOptions} onSelect={handleMonthSelect} className="bg-transparent !px-3 !py-1.5 min-w-[70px]" />
          </div>
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5">
            <PremiumSelector value={currentDate.getFullYear()} options={yearOptions} onSelect={handleYearSelect} className="bg-transparent !px-3 !py-1.5 min-w-[60px]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title={isToday(currentDate) ? "Dia Atual" : format(currentDate, "dd/MM/yyyy")} value={`R$ ${stats.day.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={CalendarDays} />
        <KPICard title={isThisMonth(currentDate) ? "Mês Recorrente" : format(currentDate, "MMMM", { locale: ptBR }).toUpperCase()} value={`R$ ${stats.month.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={TrendingUp} />
        <KPICard title="Faturamento Anual" value={`R$ ${stats.year.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={LayoutDashboard} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest italic">Análise de Faturamento</h3>
          <div className="flex bg-surface-section rounded-lg p-0.5">
            {(["diario", "semanal", "mensal", "anual"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setChartTimeframe(f)}
                className={cn(
                  "px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded transition-all",
                  f === chartTimeframe ? "bg-brand-primary text-surface-page" : "text-text-muted hover:text-white"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-surface-section/30 p-6 rounded-[2rem] h-[350px] flex flex-col border-none">
          <div className="flex-1 min-h-0">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
