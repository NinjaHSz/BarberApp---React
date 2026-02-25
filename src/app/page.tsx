"use client";

import { useClients, useExpenses, useAppointments } from "@/hooks/use-data";
import { LayoutDashboard, CalendarDays, TrendingUp, ArrowDownRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { format, isToday, isThisMonth, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";
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
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: appointments = [], isLoading: loadingAppointments } = useAppointments();
  
  const isLoading = loadingClients || loadingAppointments;

  const stats = useMemo(() => {
    const todayRevenue = appointments
      .filter(a => a.date && isToday(parseISO(a.date)))
      .reduce((acc, a) => acc + (a.value || 0), 0);

    const monthRevenue = appointments
      .filter(a => a.date && isThisMonth(parseISO(a.date)))
      .reduce((acc, a) => acc + (a.value || 0), 0);

    return {
      todayRevenue,
      monthRevenue,
      totalClients: clients.length
    };
  }, [appointments, clients]);

  const chartData = useMemo(() => {
    const months = [];
    const revenues = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const label = format(date, 'MMM');
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const rev = appointments
        .filter(a => {
          if (!a.date) return false;
          const d = parseISO(a.date);
          return d >= start && d <= end;
        })
        .reduce((acc, a) => acc + (a.value || 0), 0);
        
      months.push(label);
      revenues.push(rev);
    }

    return {
      labels: months,
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
  }, [appointments]);

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
    <div className="px-4 py-6 sm:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="space-y-0.5">
          <h2 className="text-text-primary text-xl font-black uppercase tracking-tighter">LUCAS DO CORTE — PAINEL</h2>
          <p className="text-[9px] text-text-muted font-black uppercase tracking-widest">Painel de Performance Estratégica</p>
        </div>
        <button className="text-[9px] font-black text-rose-500/50 hover:text-rose-500 transition-all uppercase tracking-widest flex items-center gap-2">
          <ArrowDownRight size={12} /> Gerar Relatório de Saídas
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Dia Atual" value={`R$ ${stats.todayRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={CalendarDays} />
        <KPICard title="Mês Corrente" value={`R$ ${stats.monthRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={TrendingUp} />
        <KPICard title="Clientes Totais" value={String(stats.totalClients)} icon={Users} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest italic">Análise de Faturamento</h3>
          <div className="flex bg-surface-section rounded-lg p-0.5">
            {["diario", "semanal", "mensal", "anual"].map((f) => (
              <button
                key={f}
                className={cn(
                  "px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded transition-all",
                  f === "mensal" ? "bg-brand-primary text-surface-page" : "text-text-muted hover:text-white"
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
