"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Send, X, MessageSquare, Sparkles, Mic, User, Bot, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  pendingAction?: any;
  availableSlots?: string[];
  dateContext?: string;
}

export function JarvisChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen && 
        chatRef.current && 
        !chatRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);
  useEffect(() => {
    const cached = localStorage.getItem("jarvis_chat_cache");
    if (cached) {
      try {
        setHistory(JSON.parse(cached).slice(-20)); // Limitar histórico para performance
      } catch (e) {
        setHistory([]);
      }
    }
  }, []);

  // Otimização: throttle no salvamento do cache (evita bloqueio da thread principal)
  useEffect(() => {
    if (history.length === 0) return;
    
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem("jarvis_chat_cache", JSON.stringify(history));
      } catch (e) {
        console.error("Cache fallido", e);
      }
    }, 1000); // Aumentado para 1s para ser menos agressivo
    
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' }); // behavior auto é mais rápido
    }
    return () => clearTimeout(timeout);
  }, [history, isOpen]);

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail.isListening !== undefined) setIsListening(e.detail.isListening);
    };
    window.addEventListener("jarvis-sync", handleSync);
    return () => window.removeEventListener("jarvis-sync", handleSync);
  }, []);

  const handleMicClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent("jarvis-remote-toggle"));
  }, []);

  const executeAction = useCallback((payload: any) => {
    window.dispatchEvent(new CustomEvent("jarvis-action", {
      detail: { type: "JARVIS_CHAT_COMMAND", payload }
    }));
  }, []);

  const handleConfirm = (payload: any, msgIndex: number) => {
    executeAction(payload);
    // Remover o estado de pendente da mensagem
    setHistory(prev => prev.map((msg, i) => 
      i === msgIndex ? { ...msg, pendingAction: null, content: msg.content + " (Confirmado)" } : msg
    ));
  };

  const handleCancel = (msgIndex: number) => {
    setHistory(prev => prev.map((msg, i) => 
      i === msgIndex ? { ...msg, pendingAction: null, content: "Ação cancelada." } : msg
    ));
  };

  const handleUndo = () => {
    window.dispatchEvent(new CustomEvent("jarvis-undo"));
    // Opcional: Feedback visual no histórico
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userCommand = message.trim();
    setHistory(prev => [...prev, { role: 'user', content: userCommand, timestamp: Date.now() }]);
    setMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: userCommand,
          currentDate: format(new Date(), "yyyy-MM-dd (EEEE)", { locale: ptBR })
        })
      });

      if (!res.ok) throw new Error("Erro");
      const data = await res.json();

      const aiMsg: ChatMessage = { 
        role: 'assistant', 
        content: data.spokenResponse || "Pronto.", 
        timestamp: Date.now(),
        availableSlots: data.availableSlots,
        dateContext: data.date
      };

      if (data.needsConfirmation) {
        aiMsg.pendingAction = data;
      } else {
        // Marcamos como tratado pelo chat para o Assistant global ignorar
        executeAction({ ...data, handledByChat: true });
      }

      setHistory(prev => [...prev, aiMsg]);

    } catch (err) {
      setHistory(prev => [...prev, { role: 'assistant', content: "Erro na conexão.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-24 right-4 z-[999] md:right-8 md:bottom-8 w-11 h-11 rounded-full bg-surface-section border border-white/10 text-brand-primary hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-2xl",
          isListening && "ring-2 ring-brand-primary animate-pulse"
        )}
      >
        {isOpen ? <X size={20} /> : <Sparkles size={20} />}
      </button>

      <div 
        ref={chatRef}
        className={cn(
          "fixed z-[998] transition-[transform,opacity] duration-300 ease-out flex flex-col shadow-2xl border border-white/5",
          "bottom-[148px] right-4 w-[calc(100%-2rem)] max-w-[380px] md:right-8 md:bottom-[82px] h-[500px]",
          "bg-[#18181b] rounded-[2rem] will-change-transform",
          isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
             <Sparkles className="text-brand-primary" size={16} />
             <span className="text-[10px] font-black text-white uppercase italic tracking-tighter">Jarvis Core</span>
          </div>
          <button onClick={() => {setHistory([]); localStorage.removeItem("jarvis_chat_cache");}} className="text-[8px] font-black text-text-muted hover:text-rose-500 uppercase tracking-widest border-none bg-transparent">
            Limpar
          </button>
        </div>

        {/* Console / History */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 custom-scroll scroll-smooth bg-[#09090b]">
          {history.map((chat, i) => (
            <div key={i} className={cn("flex flex-col w-full", chat.role === 'user' ? "items-end" : "items-start")}>
              <div className={cn(
                "relative max-w-[85%] px-3 py-2 rounded-2xl text-[12.5px] font-medium leading-normal shadow-md",
                chat.role === 'user' 
                  ? "bg-brand-primary text-black rounded-tr-none" 
                  : "bg-[#1f1f23] text-white rounded-tl-none border border-white/5"
              )}>
                {chat.content}
                
                <div className={cn(
                  "flex items-center justify-between mt-1 -mb-0.5 gap-3",
                  chat.role === 'user' ? "text-black/50" : "text-text-muted"
                )}>
                  {chat.role === 'assistant' && i === history.length - 1 && chat.content !== "Ação cancelada." && chat.content !== "Erro na conexão." && (
                    <button 
                      onClick={handleUndo}
                      title="Rebobinar última ação"
                      className="flex items-center gap-1 hover:text-white transition-colors border-none bg-transparent p-0"
                    >
                      <RotateCcw size={10} />
                      <span className="text-[8px] font-black uppercase tracking-tight">Rebobinar</span>
                    </button>
                  )}
                  <span className="text-[9px] font-bold tabular-nums ml-auto">
                    {format(chat.timestamp, "HH:mm")}
                  </span>
                </div>

                {chat.availableSlots && chat.availableSlots.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-400">
                    {chat.availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => {
                          setMessage(`Agendar para ${slot}${chat.dateContext ? ` no dia ${chat.dateContext}` : ''}`);
                        }}
                        className="bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-black border border-brand-primary/20 text-[10px] font-black px-3 py-1.5 rounded-lg transition-all active:scale-95"
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}

                {chat.pendingAction && (
                  <div className="mt-3 flex gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <button 
                      onClick={() => handleConfirm(chat.pendingAction, i)}
                      className="flex-1 h-7 bg-white text-black rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center justify-center gap-1 border-none shadow-sm"
                    >
                      <CheckCircle2 size={11} /> Confirmar
                    </button>
                    <button 
                      onClick={() => handleCancel(i)}
                      className="flex-1 h-7 bg-white/10 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center justify-center gap-1 border-none"
                    >
                      <X size={11} /> Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-1 p-2">
              <span className="w-1 h-1 bg-brand-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-1 bg-brand-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-1 bg-brand-primary rounded-full animate-bounce" />
            </div>
          )}
        </div>

        {/* Chat Footer - WhatsApp Style */}
        <div className="p-3 bg-white/[0.02] border-t border-white/5 rounded-b-[2.5rem]">
          <form onSubmit={handleSubmit} className="flex items-end gap-2 bg-surface-page/50 rounded-[1.8rem] p-1.5 ring-1 ring-white/5 focus-within:ring-brand-primary/30 transition-all">
            <button 
              type="button" 
              onClick={handleMicClick} 
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 border-none",
                isListening ? "bg-brand-primary text-black" : "text-brand-primary hover:bg-white/5"
              )}
            >
              <Mic size={18} className={cn(isListening && "animate-pulse")} />
            </button>
            
            <textarea
              autoFocus={isOpen}
              placeholder="Mensagem"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { 
                if (e.key === 'Enter' && !e.shiftKey) { 
                  e.preventDefault(); 
                  handleSubmit(e); 
                } 
              }}
              rows={1}
              className="flex-1 bg-transparent border-none py-2.5 px-1 outline-none font-medium text-[13px] text-white placeholder:text-text-muted resize-none max-h-32 custom-scroll"
            />

            <button 
              type="submit" 
              disabled={isLoading || !message.trim()} 
              className="w-10 h-10 rounded-full bg-brand-primary text-black flex items-center justify-center border-none shadow-lg disabled:opacity-20 transition-all active:scale-[0.9] shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
