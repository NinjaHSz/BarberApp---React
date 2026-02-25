"use client";

import { useSupabase } from "@/hooks/use-data";
import { Settings, Shield, Globe, Eraser, Check, X, RefreshCcw, Save, Trash2, Smartphone, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function SetupPage() {
  const queryClient = useQueryClient();
  const supabase = useSupabase();

  // Local settings (in real app, these would come from a 'settings' table or localStorage)
  const [settings, setSettings] = useState({
    shopName: "LUCAS DO CORTE",
    logoUrl: "",
    privacyMode: false,
    googleSync: false,
    sheetUrl: "",
    theme: "dark",
    autoBackup: true
  });

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("app_settings");
    if (saved) setSettings(JSON.parse(saved));
  }, []);

  const handleSave = () => {
    localStorage.setItem("app_settings", JSON.stringify(settings));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClearCache = () => {
    if (confirm("Deseja limpar todos os dados em cache? Você precisará recarregar a página.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="px-4 py-8 sm:px-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 px-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight text-text-primary uppercase italic">
            Ajustes <span className="text-text-secondary font-medium lowercase">e sistema</span>
          </h2>
          <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Configuração de Experiência e Dados</p>
        </div>
        <button 
          onClick={handleSave}
          className={cn(
            "flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl",
            isSaved ? "bg-emerald-500 text-white" : "bg-brand-primary text-surface-page shadow-brand-primary/10 hover:brightness-110"
          )}
        >
          {isSaved ? <Check size={16} /> : <Save size={16} />}
          {isSaved ? "Configurações Salvas" : "Salvar Alterações"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Visual Settings */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 px-4">
            <Settings size={18} className="text-brand-primary" />
            <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Identidade Visual</h3>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <div className="bg-surface-section/30 p-8 rounded-[2.5rem] space-y-8 border-none">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Nome da Barbearia</label>
              <input 
                type="text" 
                value={settings.shopName}
                onChange={(e) => setSettings({ ...settings, shopName: e.target.value.toUpperCase() })}
                className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-black uppercase text-sm text-white focus:ring-1 ring-brand-primary/20 transition-all"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">Logotipo (URL)</label>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={settings.logoUrl}
                  placeholder="https://..."
                  onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                  className="flex-1 bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-bold text-xs"
                />
                <div className="w-12 h-12 rounded-xl bg-surface-page flex items-center justify-center border-none overflow-hidden grayscale">
                  {settings.logoUrl ? <img src={settings.logoUrl} alt="Logo preview" className="w-full h-full object-cover" /> : <Monitor size={20} className="text-text-muted/20" />}
                </div>
              </div>
            </div>

            <div className="p-4 bg-brand-primary/5 rounded-2xl flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-brand-primary" />
                <div>
                  <p className="text-[10px] font-black text-white uppercase tracking-tight">Modo Privacidade</p>
                  <p className="text-[8px] text-text-muted font-bold uppercase tracking-widest">Oculta valores e nomes sensíveis</p>
                </div>
              </div>
              <button 
                onClick={() => setSettings({ ...settings, privacyMode: !settings.privacyMode })}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative p-1",
                  settings.privacyMode ? "bg-brand-primary" : "bg-white/10"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full bg-surface-page transition-all",
                  settings.privacyMode ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>
          </div>
        </section>

        {/* System & Data */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 px-4">
            <Globe size={18} className="text-brand-primary" />
            <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Sincronização & Backup</h3>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <div className="bg-surface-section/30 p-8 rounded-[2.5rem] space-y-8 border-none">
             <div className="p-4 bg-white/5 rounded-2xl flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <Globe size={16} className="text-text-muted" />
                <div>
                  <p className="text-[10px] font-black text-white uppercase tracking-tight">Google Sheets Sync</p>
                  <p className="text-[8px] text-text-muted font-bold uppercase tracking-widest">Sincronizar dados remotamente</p>
                </div>
              </div>
              <button 
                onClick={() => setSettings({ ...settings, googleSync: !settings.googleSync })}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative p-1",
                  settings.googleSync ? "bg-brand-primary" : "bg-white/10"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full bg-surface-page transition-all",
                  settings.googleSync ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>

            {settings.googleSync && (
               <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[9px] font-black uppercase text-text-muted tracking-widest ml-1">URL da Planilha</label>
                <input 
                  type="text" 
                  value={settings.sheetUrl}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  onChange={(e) => setSettings({ ...settings, sheetUrl: e.target.value })}
                  className="w-full bg-surface-page/50 border-none p-4 rounded-2xl outline-none font-bold text-[10px]"
                />
              </div>
            )}

            <div className="pt-4 space-y-4">
               <button 
                onClick={handleClearCache}
                className="w-full flex items-center justify-between p-4 bg-rose-500/10 hover:bg-rose-500/20 rounded-2xl group transition-all"
              >
                <div className="flex items-center gap-3">
                   <Eraser size={16} className="text-rose-500" />
                   <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Limpar Cache do Sistema</span>
                </div>
                <ChevronRight size={14} className="text-rose-500/50 group-hover:translate-x-1 transition-all" />
              </button>

              <button 
                className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl group transition-all"
              >
                <div className="flex items-center gap-3">
                   <RefreshCcw size={16} className="text-text-muted" />
                   <span className="text-[10px] font-black text-white uppercase tracking-widest">Forçar Sincronização</span>
                </div>
                <ChevronRight size={14} className="text-text-muted/50 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Info Section */}
      <div className="px-4 text-center">
        <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.3em]">BarberApp Pro v1.0.0 — Licensed for {settings.shopName}</p>
      </div>
    </div>
  );
}

function ChevronRight({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
