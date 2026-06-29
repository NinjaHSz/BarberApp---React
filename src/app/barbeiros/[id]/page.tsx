"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBarbers, useSupabase, useAppointments } from "@/hooks/use-data";
import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  TrendingUp, 
  History, 
  CreditCard, 
  Clock 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import { 
  format, 
  parseISO, 
  addDays, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  isSameYear 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InlineInput } from "@/components/shared/inline-input";
import { PremiumSelector } from "@/components/shared/premium-selector";
import { useAgenda } from "@/lib/contexts/agenda-context";

export default function BarberProfilePage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const supabase = useSupabase();
  const { data: barbers = [], isLoading: loadingBarbers } = useBarbers();
  const { data: appointments = [], isLoading: loadingAppointments } = useAppointments();

  const { selectedDate: currentDate, setSelectedDate: setCurrentDate } = useAgenda();
  const [timeframe, setTimeframe] = useState<"dia" | "mes" | "ano" | "tudo">("mes");
  const [visibleCount, setVisibleCount] = useState(50);

  const barber = useMemo(() => barbers.find(b => String(b.id) === id), [barbers, id]);

  const barberAppointments = useMemo(() => {
    if (!barber) return [];
    return appointments
      .filter(a => String(a.barberId) === id)
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || "00:00"}`);
        const dateB = new Date(`${b.date}T${b.time || "00:00"}`);
        return dateB.getTime() - dateA.getTime();
      });
  }, [appointments, barber, id]);

  const filteredBarberAppointments = useMemo(() => {
    return barberAppointments.filter((appt) => {
      const apptDate = parseISO(appt.date);
      if (timeframe === "dia") {
        return isSameDay(apptDate, currentDate);
      } else if (timeframe === "mes") {
        return isSameMonth(apptDate, currentDate);
      } else if (timeframe === "ano") {
        return isSameYear(apptDate, currentDate);
      }
      return true; // "tudo"
    });
  }, [barberAppointments, timeframe, currentDate]);

  const stats = useMemo(() => {
    const totalSpent = filteredBarberAppointments.reduce((acc, a) => acc + (a.value || 0), 0);
    const count = filteredBarberAppointments.length;
    
    return {
      totalRevenue: totalSpent,
      appointmentCount: count,
      ticketMedio: count ? totalSpent / count : 0
    };
  }, [filteredBarberAppointments]);

  const visibleAppointments = useMemo(() => {
    return filteredBarberAppointments.slice(0, visibleCount);
  }, [filteredBarberAppointments, visibleCount]);

  const updateMutation = useMutation({
    mutationFn: async (updatedFields: any) => {
      const { error } = await supabase
        .from("barbeiros")
        .update(updatedFields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barbers"] });
    }
  });

  const handleDayChange = useCallback((delta: number) => setCurrentDate(prev => delta > 0 ? addDays(prev, delta) : subDays(prev, Math.abs(delta))), [setCurrentDate]);
  const handleDaySelect = useCallback((day: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setDate(day); return d; }); }, [setCurrentDate]);
  const handleMonthSelect = useCallback((month: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setMonth(month - 1); return d; }); }, [setCurrentDate]);
  const handleYearSelect = useCallback((year: number) => { setCurrentDate(prev => { const d = new Date(prev); d.setFullYear(year); return d; }); }, [setCurrentDate]);

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

  if (loadingBarbers || loadingAppointments) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!barber) {
    return (
      <div className="px-8 pt-6 text-center max-w-lg mx-auto space-y-4">
        <p className="text-text-muted text-xs font-black uppercase tracking-widest">Barbeiro não encontrado</p>
        <Link href="/barbeiros" className="inline-flex items-center gap-2 text-brand-primary text-xs font-black uppercase tracking-widest hover:brightness-110">
          <ChevronLeft size={14} /> Voltar para Barbeiros
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 sm:px-8 sm:pt-6 space-y-6 animate-in fade-in duration-500 pb-32 max-w-7xl mx-auto">
      {/* Top Navigation */}
      <div className="flex justify-between items-center">
        <Link 
          href="/barbeiros" 
          className="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest shrink-0"
        >
          <ChevronLeft size={12} /> Voltar para Barbeiros
        </Link>
      </div>

      {/* Profile Header */}
      <div className="glass-card rounded-[2.5rem] p-6 lg:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-2xl">
        <div className="flex items-center gap-6 min-w-0">
          <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-[2rem] bg-white/5 flex items-center justify-center text-brand-primary shadow-2xl shrink-0">
            <User size={36} />
          </div>
          <div className="space-y-2 min-w-0">
            <InlineInput
              value={barber.nome}
              onSave={(val) => updateMutation.mutate({ nome: val })}
              className="text-3xl lg:text-4xl font-black text-white uppercase tracking-tight"
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[8px] bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full font-black uppercase tracking-widest">
                Profissional
              </span>
              <button
                onClick={() => updateMutation.mutate({ ativo: !barber.ativo })}
                className={cn(
                  "text-[8px] px-3 py-1 rounded-full font-black uppercase tracking-widest flex items-center gap-1 border-none cursor-pointer transition-all",
                  barber.ativo 
                    ? "bg-emerald-500/10 text-emerald-400" 
                    : "bg-rose-500/10 text-rose-400"
                )}
              >
                {barber.ativo ? (
                  <>
                    <CheckCircle size={10} /> Ativo
                  </>
                ) : (
                  <>
                    <XCircle size={10} /> Inativo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Contact info inline */}
        <div className="w-full md:w-auto bg-white/[0.02] p-4 lg:p-6 rounded-[1.75rem] flex items-center gap-4 border-none shadow-inner shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary">
            <Phone size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">Telefone</span>
            <InlineInput
              value={barber.telefone || "Não cadastrado"}
              onSave={(val) => updateMutation.mutate({ telefone: val })}
              className="text-sm font-bold text-white uppercase"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-[2rem] p-6 flex items-center gap-4 shadow-xl border-none">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-brand-primary shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">
              Faturamento ({timeframe})
            </p>
            <p className="text-xl font-black text-white mt-1">
              R$ {stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="glass-card rounded-[2rem] p-6 flex items-center gap-4 shadow-xl border-none">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-brand-primary shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">
              Atendimentos ({timeframe})
            </p>
            <p className="text-xl font-black text-white mt-1">
              {stats.appointmentCount} <span className="text-xs text-text-secondary font-medium">cortes</span>
            </p>
          </div>
        </div>

        <div className="glass-card rounded-[2rem] p-6 flex items-center gap-4 shadow-xl border-none">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-brand-primary shrink-0">
            <CreditCard size={20} />
          </div>
          <div>
            <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">
              Ticket Médio ({timeframe})
            </p>
            <p className="text-xl font-black text-white mt-1">
              R$ {stats.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Date Pickers and Timeframe Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-section/10 p-4 rounded-[1.5rem] border-none shadow-2xl">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0">
            <button onClick={() => handleDayChange(-1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronLeft size={14} /></button>
            <PremiumSelector value={currentDate.getDate()} options={dayOptions} onSelect={handleDaySelect} className="bg-transparent !px-2 !py-1.5 w-[85px]" />
            <button onClick={() => handleDayChange(1)} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors border-none"><ChevronRight size={14} /></button>
          </div>
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0">
            <PremiumSelector value={currentDate.getMonth() + 1} options={monthOptions} onSelect={handleMonthSelect} className="bg-transparent !px-3 !py-1.5 min-w-[70px]" />
          </div>
          <div className="flex items-center bg-surface-section rounded-2xl p-0.5 shrink-0">
            <PremiumSelector value={currentDate.getFullYear()} options={yearOptions} onSelect={handleYearSelect} className="bg-transparent !px-3 !py-1.5 min-w-[55px]" />
          </div>
        </div>

        <div className="flex bg-surface-section p-1 rounded-2xl gap-1 shrink-0">
          {(["dia", "mes", "ano", "tudo"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTimeframe(t);
                setVisibleCount(50);
              }}
              className={cn(
                "px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all border-none cursor-pointer",
                timeframe === t
                  ? "bg-brand-primary text-surface-page shadow-md"
                  : "text-text-secondary hover:text-white hover:bg-white/5"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Appointment History */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <History size={16} className="text-brand-primary" />
          <h3 className="text-xs font-black text-text-primary uppercase tracking-widest">
            Histórico ({timeframe})
          </h3>
        </div>

        {filteredBarberAppointments.length === 0 ? (
          <div className="bg-surface-section/10 p-12 rounded-[2rem] text-center border-none shadow-xl">
            <p className="text-text-muted text-xs font-black uppercase tracking-widest">Nenhum atendimento realizado neste período</p>
          </div>
        ) : (
          <div className="bg-surface-section/20 rounded-[2rem] overflow-hidden shadow-2xl p-2 border-none">
            <div className="hidden md:grid md:grid-cols-[110px_70px_1fr_1.5fr_100px_100px] gap-4 px-6 py-4 text-[9px] font-black text-text-muted uppercase tracking-widest border-b border-white/[0.02]">
              <span>Data</span>
              <span>Horário</span>
              <span>Cliente</span>
              <span>Procedimento</span>
              <span>Valor</span>
              <span>Forma</span>
            </div>

            <div className="divide-y divide-white/[0.02]">
              {visibleAppointments.map((appt) => (
                <div 
                  key={appt.id} 
                  className="grid grid-cols-1 md:grid-cols-[110px_70px_1fr_1.5fr_100px_100px] gap-4 items-center px-6 py-4 hover:bg-white/[0.01] transition-colors"
                >
                  {/* Date */}
                  <div className="flex items-center gap-2 text-xs font-black text-white/90">
                    <Calendar size={12} className="text-text-muted md:hidden" />
                    {format(parseISO(appt.date), "dd MMM yyyy", { locale: ptBR })}
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2 text-xs text-text-secondary md:text-white md:font-bold">
                    <Clock size={12} className="text-text-muted md:hidden" />
                    {appt.time ? appt.time.substring(0, 5) : "---"}
                  </div>

                  {/* Client */}
                  <div className="text-sm font-black text-white uppercase tracking-tight md:truncate">
                    {appt.client}
                  </div>

                  {/* Procedure */}
                  <div className="text-xs font-bold text-text-secondary uppercase truncate">
                    {appt.service}
                  </div>

                  {/* Value */}
                  <div className="text-xs font-black text-brand-primary">
                    R$ {(appt.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>

                  {/* Payment method */}
                  <div className="text-[10px] font-black text-text-secondary uppercase tracking-wider">
                    {appt.paymentMethod}
                  </div>
                </div>
              ))}
            </div>

            {filteredBarberAppointments.length > visibleCount && (
              <div className="flex justify-center p-4 border-t border-white/[0.02] bg-white/[0.01]">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 50)}
                  className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-[9px] uppercase tracking-widest transition-all border-none cursor-pointer"
                >
                  Carregar Mais
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
