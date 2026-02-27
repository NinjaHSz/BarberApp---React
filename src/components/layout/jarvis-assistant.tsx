"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useClients } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { Mic, Sparkles, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAgenda } from "@/lib/contexts/agenda-context";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function JarvisAssistant({ sidebarOnly = false, globalOnly = false }: { sidebarOnly?: boolean, globalOnly?: boolean }) {
  const router = useRouter();
  const { setSelectedDate } = useAgenda();
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);

  const { data: clients = [] } = useClients();
  
  const stateRef = useRef({ isActive: false, isProcessing: false });
  const clientsRef = useRef(clients);

  useEffect(() => {
    stateRef.current = { isActive, isProcessing };
    clientsRef.current = clients;
  }, [isActive, isProcessing, clients]);

  // Sincronização entre instâncias via Eventos Customizados
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail.isListening !== undefined) setIsListening(e.detail.isListening);
      if (e.detail.isActive !== undefined) setIsActive(e.detail.isActive);
      if (e.detail.isProcessing !== undefined) setIsProcessing(e.detail.isProcessing);
      if (e.detail.transcript !== undefined) setTranscript(e.detail.transcript);
      if (e.detail.error !== undefined) setError(e.detail.error);
    };

    window.addEventListener("jarvis-sync", handleSync);
    return () => window.removeEventListener("jarvis-sync", handleSync);
  }, []);

  const syncState = useCallback((updates: any) => {
    window.dispatchEvent(new CustomEvent("jarvis-sync", { detail: updates }));
  }, []);

  // Sobrescrever setStates para sincronizar
  const setListeningSync = (val: boolean) => { setIsListening(val); syncState({ isListening: val }); };
  const setActiveSync = (val: boolean) => { setIsActive(val); syncState({ isActive: val }); };
  const setProcessingSync = (val: boolean) => { setIsProcessing(val); syncState({ isProcessing: val }); };
  const setTranscriptSync = (val: string) => { setTranscript(val); syncState({ transcript: val }); };

  const processCommand = useCallback(async (text: string) => {
    const normalized = text.toLowerCase().trim();
    if (!normalized) return;

    setProcessingSync(true);
    stateRef.current.isProcessing = true;
    setTranscriptSync(`Analisando: "${text}"`);
    setActiveSync(true);

    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: normalized,
          currentDate: format(new Date(), "yyyy-MM-dd (EEEE)", { locale: ptBR })
        })
      });

      if (!res.ok) throw new Error("Erro de conexão");

      const data = await res.json();
      console.log("Jarvis Respondido: ", data);

      // Falar a resposta da IA primeiro
      if (data.spokenResponse) {
        const utterance = new SpeechSynthesisUtterance(data.spokenResponse);
        utterance.lang = "pt-BR";
        window.speechSynthesis.speak(utterance);
      }

      // Executar a Intenção
      if (data.intent === "agendar") {
        const isClientNull = !data.clientName || data.clientName === "null" || data.clientName === null;
        let clientObj = null;

        if (!isClientNull) {
           const iaName = String(data.clientName).toLowerCase();
           clientObj = clientsRef.current.find(c => {
               const dbName = c.nome.toLowerCase();
               return dbName === iaName || dbName.includes(iaName) || iaName.includes(dbName);
           });
        }

        const finalClientName = clientObj?.nome || (!isClientNull ? data.clientName : "");
        
        if (!finalClientName || finalClientName.trim() === "") {
          const u = new SpeechSynthesisUtterance("Não identifiquei o cliente. Poderia repetir o nome?");
          u.lang = "pt-BR";
          window.speechSynthesis.speak(u);
        } else {
          const finalTime = data.time || "08:00";
          const finalDate = data.date || format(new Date(), "yyyy-MM-dd");

          window.dispatchEvent(new CustomEvent("jarvis-action", {
              detail: { type: "AGENDA_OPEN", payload: { clientName: finalClientName, time: finalTime, date: finalDate } }
          }));
        }
      } else if (data.intent === "navegar" && data.path) {
        router.push(data.path);
      } else if (data.intent === "mudar_data" && data.date) {
        const newDate = parse(data.date, "yyyy-MM-dd", new Date());
        setSelectedDate(newDate);
      }

      // Limpar UI após execução
      setTimeout(() => {
        setProcessingSync(false);
        setActiveSync(false);
        stateRef.current.isProcessing = false;
        setTranscriptSync("");
      }, 2000);

    } catch (err) {
      console.error(err);
      setTranscriptSync("Erro no processamento.");
      setTimeout(() => { setProcessingSync(false); setActiveSync(false); setTranscriptSync(""); }, 2000);
    }
  }, [router, setSelectedDate]);

  // Listener para Comandos do Chat e Ações IA
  useEffect(() => {
    const handleAction = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail) return;
      
      const { type, payload } = customEvent.detail;

      // Se for comando do chat, usa a mesma lógica de execução do Jarvis
      if (type === "JARVIS_CHAT_COMMAND") {
        const data = payload;

        // Se o chat já cuidou disso (handledByChat), não mostramos UI de carregamento nem falamos
        const skipFeedback = data && data.handledByChat;
        if (skipFeedback) {
          setProcessingSync(false);
          setActiveSync(false);
        }

        if (data.intent === "navegar" && data.path) {
          router.push(data.path);
        } else if (data.intent === "mudar_data" && data.date) {
          const newDate = parse(data.date, "yyyy-MM-dd", new Date());
          setSelectedDate(newDate);
        } else if (data.intent === "agendar") {
          // Resolver nome do cliente se necessário (mesma lógica do processCommand)
          let finalClientName = data.clientName;
          if (data.clientName && data.clientName !== "null") {
             const iaName = String(data.clientName).toLowerCase();
             const clientObj = clientsRef.current.find(c => {
                 const dbName = c.nome.toLowerCase();
                 return dbName === iaName || dbName.includes(iaName) || iaName.includes(dbName);
             });
             if (clientObj) finalClientName = clientObj.nome;
          }

          // Disparar ação para a Agenda
          window.dispatchEvent(new CustomEvent("jarvis-action", {
             detail: { 
               type: "AGENDA_OPEN", 
               payload: { ...data, clientName: finalClientName } 
             }
          }));
        }
      }  
        // Resetar estado de processamento global para que o ícone de carregando desapareça
        setProcessingSync(false);
        setActiveSync(false);
      };

      window.addEventListener("jarvis-action", handleAction);
      return () => window.removeEventListener("jarvis-action", handleAction);
    }, [router, setSelectedDate]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setListeningSync(false);
    
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || stateRef.current.isProcessing) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
         if (audioChunksRef.current.length === 0) {
           setProcessingSync(false);
           stateRef.current.isProcessing = false;
           return;
         }
         
         setProcessingSync(true);
         stateRef.current.isProcessing = true;
         setTranscriptSync("Ouvindo...");
         
         const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
         const formData = new FormData();
         formData.append("file", audioBlob, "audio.webm");
         
         try {
           setActiveSync(true);
           const res = await fetch("/api/jarvis/transcribe", { method: "POST", body: formData });
           if (!res.ok) throw new Error(`Status ${res.status}`);
           
           const data = await res.json();
           const text = data.text?.trim() || "";
           
           if (!text) {
             setTranscriptSync("Não ouvi nada.");
             setTimeout(() => { setProcessingSync(false); setActiveSync(false); stateRef.current.isProcessing = false; setTranscriptSync(""); }, 2000);
             return;
           }
           
           await processCommand(text);

         } catch (err: any) {
           console.error("Transcription error:", err);
           setTranscriptSync("Erro na transcrição.");
           setTimeout(() => { setProcessingSync(false); setActiveSync(false); setTranscriptSync(""); }, 2000);
         }
      };
      
      mediaRecorder.start(1000);
      isRecordingRef.current = true;
      setListeningSync(true);
      setError(null);
      setTranscriptSync("🎧 Gravando...");
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const detectSilence = () => {
        if (!isRecordingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const avg = sum / bufferLength;
        
        if (avg > 5) { 
           if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
           silenceTimerRef.current = setTimeout(() => { stopRecording(); }, 2500); 
        }
        requestAnimationFrame(detectSilence);
      };
      
      silenceTimerRef.current = setTimeout(() => { stopRecording(); }, 7000); 
      detectSilence();
      
    } catch (err) {
        setError("Microfone Bloqueado");
    }
  }, [processCommand, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (sidebarOnly) {
       window.dispatchEvent(new CustomEvent("jarvis-remote-toggle"));
       return;
    }
    if (isListening) stopRecording();
    else startRecording();
  }, [isListening, startRecording, stopRecording, sidebarOnly]);

  useEffect(() => {
    if (globalOnly || (!sidebarOnly && !globalOnly)) {
      const handleRemote = () => toggleRecording();
      window.addEventListener("jarvis-remote-toggle", handleRemote);
      return () => window.removeEventListener("jarvis-remote-toggle", handleRemote);
    }
  }, [toggleRecording, globalOnly, sidebarOnly]);

  useEffect(() => {
    if (sidebarOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || (activeEl as HTMLElement)?.isContentEditable;
      if (e.code === "Space" && !isInput) {
        e.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleRecording, sidebarOnly]);

  if (sidebarOnly) {
    return (
      <button 
        onClick={toggleRecording} 
        className={cn(
          "flex items-center h-12 px-0 group-hover/sidebar:px-4 transition-all duration-200 relative w-full",
          isListening ? "bg-surface-subtle text-white" : "text-text-secondary hover:bg-white/5 hover:text-white"
        )}
      >
        <div className="w-20 shrink-0 flex items-center justify-center">
           <Mic size={20} className={cn(isListening && "text-brand-primary animate-pulse")} />
        </div>
        <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity text-xs font-bold uppercase tracking-wider whitespace-nowrap">
          Jarvis AI
        </span>
        {isListening && (
          <div className="absolute left-0 w-1 h-6 bg-brand-primary rounded-r-full group-hover/sidebar:h-8 transition-all" />
        )}
      </button>
    );
  }

  return (
    <>
      <div className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] transition-[transform,opacity] duration-300 pointer-events-none w-full max-w-sm px-4",
        (isActive || isProcessing || error || transcript) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <div className="bg-[#18181b] border border-white/10 px-6 py-4 rounded-3xl text-white shadow-2xl flex items-center gap-4 justify-center">
          {error ? <AlertCircle className="text-rose-500" size={18} /> : <Sparkles className="text-brand-primary animate-pulse" size={18} />}
          <div className="flex flex-col text-center min-w-[200px]">
            <span className="font-bold text-xs tracking-tight uppercase italic break-words">
                {error || transcript || "Jarvis..."}
            </span>
          </div>
        </div>
      </div>

      {!globalOnly && (
        <button 
          onClick={toggleRecording} 
          className={cn(
            "flex items-center h-12 px-0 group-hover/sidebar:px-4 transition-all duration-200 relative w-full",
            isListening ? "bg-surface-subtle text-white" : "text-text-secondary hover:bg-white/5 hover:text-white"
          )}
        >
          <div className="w-20 shrink-0 flex items-center justify-center">
             <Mic size={20} className={cn(isListening && "text-brand-primary animate-pulse")} />
          </div>
          <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity text-xs font-bold uppercase tracking-wider whitespace-nowrap">
            Jarvis AI
          </span>
          {isListening && (
            <div className="absolute left-0 w-1 h-6 bg-brand-primary rounded-r-full group-hover/sidebar:h-8 transition-all" />
          )}
        </button>
      )}
    </>
  );
}
