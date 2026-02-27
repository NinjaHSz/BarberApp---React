"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useClients } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { Mic, Sparkles, AlertCircle } from "lucide-react";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function JarvisAssistant() {
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

  const processCommand = useCallback(async (text: string) => {
    const normalized = text.toLowerCase().trim();
    if (!normalized) return;

    // Apenas passamos o comando, sem restrições de wakeWord agora que o botão é explícito
    setIsProcessing(true);
    stateRef.current.isProcessing = true;
    setTranscript(`Processando com IA: "${text}"`);
    setIsActive(true);

    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: normalized,
          currentDate: format(new Date(), "yyyy-MM-dd (EEEE)", { locale: ptBR })
        })
      });

      if (!res.ok) throw new Error("Erro de comunicação com o Cérebro");

      const data = await res.json();
      console.log("Jarvis Processamento IA: ", data);

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
        const isTimeNull = !data.time || data.time === "null" || data.time === null;
        const finalTime = !isTimeNull ? data.time : "08:00";
        const isDateNull = !data.date || data.date === "null" || data.date === null;
        const finalDate = !isDateNull ? data.date : format(new Date(), "yyyy-MM-dd");

        const customEvent = new CustomEvent("jarvis-action", {
            detail: { type: "AGENDA_OPEN", payload: { clientName: finalClientName, time: finalTime, date: finalDate } }
        });
        
        window.dispatchEvent(customEvent);
        
        const msgName = clientObj ? clientObj.nome : (!isClientNull ? data.clientName : "você");
        
        const spokenTime = data.spokenTime || finalTime;
        const spokenDate = data.spokenDate ? ` ${data.spokenDate}` : ""; 
        
        const utterance = new SpeechSynthesisUtterance(`${msgName} agendado para as ${spokenTime}${spokenDate}.`);
        utterance.lang = "pt-BR";
        utterance.onend = () => {
          setIsProcessing(false);
          setIsActive(false);
          stateRef.current.isProcessing = false;
          setTranscript("");
        };
        window.speechSynthesis.speak(utterance);
      } else {
         const utterance = new SpeechSynthesisUtterance("Não entendi uma intenção de agendamento clara.");
         utterance.lang = "pt-BR";
         utterance.onend = () => {
           setIsProcessing(false);
           setIsActive(false);
           stateRef.current.isProcessing = false;
           setTranscript("");
         };
         window.speechSynthesis.speak(utterance);
      }

    } catch (err) {
      console.error(err);
      const utterance = new SpeechSynthesisUtterance("Estou sem conexão com a Inteligência.");
      utterance.lang = "pt-BR";
      utterance.onend = () => {
         setIsProcessing(false);
         setIsActive(false);
         stateRef.current.isProcessing = false;
         setTranscript("");
      };
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsListening(false);
    
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
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
         if (audioChunksRef.current.length === 0) return;
         
         setIsProcessing(true);
         stateRef.current.isProcessing = true;
         setTranscript("Traduzindo voz com Whisper (Groq)...");
         
         const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
         const formData = new FormData();
         formData.append("file", audioBlob, "audio.webm");
         
         try {
           setIsActive(true);
           const res = await fetch("/api/jarvis/transcribe", { method: "POST", body: formData });
           if (!res.ok) throw new Error("Erro na API de Transcrição Whisper");
           
           const data = await res.json();
           const text = data.text?.trim() || "";
           
           if (!text) {
             setTranscript("Não ouvi som inteligível.");
             setTimeout(() => { setIsProcessing(false); setIsActive(false); stateRef.current.isProcessing = false; setTranscript(""); }, 3000);
             return;
           }
           
           // Sucesso: passa a bola pro ChatGPT pensar o que significa a frase limpa
           processCommand(text);

         } catch (err) {
           console.error(err);
           const utterance = new SpeechSynthesisUtterance("O ouvido do Whisper falhou.");
           utterance.lang = "pt-BR";
           utterance.onend = () => { setIsProcessing(false); setIsActive(false); stateRef.current.isProcessing = false; setTranscript(""); };
           window.speechSynthesis.speak(utterance);
         }
      };
      
      mediaRecorder.start(500); // 500ms timeslice para acumular as chunks sem travar o blob
      isRecordingRef.current = true;
      setIsListening(true);
      setError(null);
      setTranscript("🎧 Gravando... (Comece a falar)");
      
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
        
        // Se a voz for perceptível (cálculo de limiar super sensível)
        if (avg > 3) { 
           if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
           // Cancela gravação ao ter 2.5 segundos cravados de puro silêncio
           silenceTimerRef.current = setTimeout(() => { stopRecording(); }, 2500); 
        }
        
        requestAnimationFrame(detectSilence);
      };
      
      // Auto cancel timer if completely silent for 7 segundos (Dando tempo pra ele pensar)
      silenceTimerRef.current = setTimeout(() => { stopRecording(); }, 7000); 
      detectSilence();
      
    } catch (err) {
       console.error("Mic error:", err);
       setError("Microfone Bloqueado");
    }
  }, [processCommand, stopRecording]);

  const toggleRecording = () => {
    if (isListening) {
      stopRecording(); // Parada manual (Push-to-stop)
    } else {
      startRecording();
    }
  };

  return (
    <>
      <div className={cn(
        "fixed inset-0 pointer-events-none z-[9999] transition-all duration-700 border-[0px]",
        (isActive || isProcessing) ? "border-brand-primary/40 shadow-[inset_0_0_150px_rgba(212,212,216,0.25)] border-[12px]" : "border-transparent"
      )} />

      {/* Balão de Mensagem */}
      <div className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 pointer-events-none w-full max-w-sm px-4",
        (isActive || isProcessing || error || transcript) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <div className="bg-surface-section/95 border border-white/10 backdrop-blur-2xl px-6 py-4 rounded-3xl text-white shadow-2xl flex items-center gap-4 justify-center">
          {error ? <AlertCircle className="text-rose-500" size={20} /> : <Sparkles className="text-brand-primary animate-pulse" size={20} />}
          <div className="flex flex-col text-center min-w-[200px]">
            <span className="font-bold text-sm tracking-tight capitalize break-words">
                {error || transcript || "Jarvis ouvindo..."}
            </span>
          </div>
        </div>
      </div>

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
    </>
  );
}
