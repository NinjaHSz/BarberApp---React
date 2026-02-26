"use client";

import { useClients, useExpenses, useAppointments } from "@/hooks/use-data";
import { LayoutDashboard, CalendarDays, TrendingUp, ArrowDownRight, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import { 
  format, 
  isToday, 
  isThisMonth, 
  isThisYear, 
  parseISO, 
  subMonths, 
  startOfMonth, 
  endOfMonth,
  addDays,
  subDays,
  subWeeks,
  subYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  getDay,
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
  const [chartTimeframe, setChartTimeframe] = useState("mensal");
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: appointments = [], isLoading: loadingAppointments } = useAppointments();
  const { data: expenses = [], isLoading: loadingExpenses } = useExpenses();
  
  const isLoading = loadingClients || loadingAppointments || loadingExpenses;

  const handleDayChange = useCallback((delta: number) => setCurrentDate(prev => delta > 0 ? addDays(prev, delta) : subDays(prev, Math.abs(delta))), []);
  const handleDaySelect = useCallback((day: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setDate(day); return d; }); }, []);
  const handleMonthSelect = useCallback((month: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setMonth(month - 1); return d; }); }, []);
  const handleYearSelect = useCallback((year: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setFullYear(year); return d; }); }, []);

  const stats = useMemo(() => {
    const selectedDayRevenue = appointments
      .filter(a => a.date && isSameDay(parseISO(a.date), currentDate))
      .reduce((acc, a) => acc + (a.value || 0), 0);

    const selectedMonthRevenue = appointments
      .filter(a => a.date && isSameMonth(parseISO(a.date), currentDate))
      .reduce((acc, a) => acc + (a.value || 0), 0);

    const selectedYearRevenue = appointments
      .filter(a => a.date && isSameYear(parseISO(a.date), currentDate))
      .reduce((acc, a) => acc + (a.value || 0), 0);

    return {
      todayRevenue: selectedDayRevenue,
      monthRevenue: selectedMonthRevenue,
      yearRevenue: selectedYearRevenue
    };
  }, [appointments, currentDate]);

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const dayOptions = daysInMonth.map((d: Date) => ({ value: d.getDate(), label: `${format(d, 'EEE', { locale: ptBR }).toUpperCase().slice(0, 3)} ${format(d, 'dd')}` }));
  const monthOptions = [ { value: 1, label: "JAN" }, { value: 2, label: "FEV" }, { value: 3, label: "MAR" }, { value: 4, label: "ABR" }, { value: 5, label: "MAI" }, { value: 6, label: "JUN" }, { value: 7, label: "JUL" }, { value: 8, label: "AGO" }, { value: 9, label: "SET" }, { value: 10, label: "OUT" }, { value: 11, label: "NOV" }, { value: 12, label: "DEZ" } ];
  const yearOptions = [ { value: 2024, label: "'24" }, { value: 2025, label: "'25" }, { value: 2026, label: "'26" } ];

  const chartData = useMemo(() => {
    let labels: string[] = [];
    let revenues: number[] = [];

    if (chartTimeframe === "diario") {
      // Show every 2 hours from 08:00 to 20:00
      const hours = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
      labels = hours;
      revenues = hours.map(h => {
        const hInt = parseInt(h.split(":")[0]);
        return appointments
          .filter(a => {
            if (!a.date || !a.time) return false;
            const aDate = parseISO(a.date);
            const aHour = parseInt(a.time.split(":")[0]);
            return isSameDay(aDate, currentDate) && (aHour === hInt || aHour === hInt + 1);
          })
          .reduce((acc, a) => acc + (a.value || 0), 0);
      });
    } else if (chartTimeframe === "semanal") {
      // Monday to Saturday (1 to 6 in getDay)
      const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
      const days = eachDayOfInterval({ start, end: addDays(start, 5) });
      labels = days.map(d => format(d, 'EEE', { locale: ptBR }).toUpperCase());
      revenues = days.map(d => {
        return appointments
          .filter(a => a.date && isSameDay(parseISO(a.date), d))
          .reduce((acc, a) => acc + (a.value || 0), 0);
      });
    } else if (chartTimeframe === "mensal") {
      // All days of the specific month
      const days = eachDayOfInterval({ 
        start: startOfMonth(currentDate), 
        end: endOfMonth(currentDate) 
      });
      labels = days.map(d => format(d, 'dd'));
      revenues = days.map(d => {
        return appointments
          .filter(a => a.date && isSameDay(parseISO(a.date), d))
          .reduce((acc, a) => acc + (a.value || 0), 0);
      });
    } else if (chartTimeframe === "anual") {
      // All 12 months of the year
      const months = eachMonthOfInterval({
        start: startOfYear(currentDate),
        end: endOfYear(currentDate)
      });
      labels = months.map(m => format(m, 'MMM', { locale: ptBR }).toUpperCase());
      revenues = months.map(m => {
        return appointments
          .filter(a => a.date && isSameMonth(parseISO(a.date), m))
          .reduce((acc, a) => acc + (a.value || 0), 0);
      });
    }

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
  }, [appointments, currentDate, chartTimeframe]);

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
          color: '#64748b',
          font: { size: 10 },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#64748b',
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
        <KPICard title={isToday(currentDate) ? "Dia Atual" : format(currentDate, "dd/MM/yyyy")} value={`R$ ${stats.todayRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={CalendarDays} />
        <KPICard title={isThisMonth(currentDate) ? "Mês Recorrente" : format(currentDate, "MMMM", { locale: ptBR }).toUpperCase()} value={`R$ ${stats.monthRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={TrendingUp} />
        <KPICard title="Faturamento Anual" value={`R$ ${stats.yearRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={LayoutDashboard} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest italic">Análise de Faturamento</h3>
          <div className="flex bg-surface-section rounded-lg p-0.5">
            {["diario", "semanal", "mensal", "anual"].map((f) => (
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
