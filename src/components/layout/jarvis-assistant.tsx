"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { format, addDays, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useClients } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { Mic, MicOff, Sparkles } from "lucide-react";

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function JarvisAssistant() {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false); // Jarvis is actively listening for a command
  const [lastTranscript, setLastTranscript] = useState("");
  const [status, setStatus] = useState<"idle" | "listening" | "processing">("idle");
  
  const recognitionRef = useRef<any>(null);
  const statusRef = useRef<"idle" | "listening" | "processing">("idle");
  const { data: clients = [] } = useClients();

  // Keep statusRef in sync with state for callbacks
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Initialize Speech Recognition ONCE
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let shouldBeRunning = true;

    if (SpeechRecognition && !recognitionRef.current) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => (result as any)[0].transcript)
          .join("")
          .toLowerCase();

        setLastTranscript(transcript);

        // Logic for Wake Word "Jarvis" - Use statusRef to avoid effect re-run
        if (transcript.includes("jarvis") && statusRef.current === "idle") {
          startCommandSession();
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "aborted") return;
        console.error("Speech recognition error", event.error);
        if (event.error === "not-allowed") {
           shouldBeRunning = false;
           setStatus("idle");
        }
      };

      recognition.onend = () => {
        // Restart only if it should be running and was stopped naturally
        if (shouldBeRunning) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore if already started
          }
        }
      };

      recognitionRef.current = recognition;
      
      try {
        recognition.start();
      } catch (e) {
        console.error("Failed to start recognition", e);
      }
    }

    return () => {
      shouldBeRunning = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []); // Run only once on mount

  const startCommandSession = () => {
    setStatus("listening");
    setIsActive(true);
    
    // Play a subtle sound or feedback could go here
    
    // Auto-timeout for the command if nothing is heard
    setTimeout(() => {
      finishCommandSession();
    }, 8000);
  };

  const finishCommandSession = () => {
    setStatus("idle");
    setIsActive(false);
    setLastTranscript("");
  };

  // Process the transcript when Jarvis is active
  useEffect(() => {
    if (status === "listening" && lastTranscript) {
      // Find the text AFTER the word "jarvis"
      const parts = lastTranscript.split("jarvis");
      const command = parts[parts.length - 1].trim();

      if (command.length > 5) {
        processCommand(command);
      }
    }
  }, [lastTranscript, status]);

  const processCommand = (text: string) => {
    console.log("Processing Jarvis Command:", text);

    // SIMPLE PARSING LOGIC - Can be improved with a more robust parser
    
    // 1. Action: Agendar
    if (text.includes("agendar") || text.includes("marcar")) {
      handleAgendaCommand(text);
    }
    
    // Support for other commands can be added here
  };

  const handleAgendaCommand = (text: string) => {
    // Attempt to extract client name
    const client = clients.find(c => 
      text.toLowerCase().includes(c.nome.toLowerCase())
    );

    // Attempt to extract time (regex for 00:00 or 00h00)
    const timeMatch = text.match(/(\d{1,2})[:h](\d{2})/) || text.match(/às (\d{1,2})/);
    let time = "";
    if (timeMatch) {
      const h = timeMatch[1].padStart(2, '0');
      const m = timeMatch[2] || "00";
      time = `${h}:${m}`;
    }

    // Attempt to extract date
    let date = new Date();
    if (text.includes("amanhã")) {
      date = addDays(date, 1);
    }

    console.log("Jarvis Parsed:", { client: client?.nome, time, date: format(date, "yyyy-MM-dd") });

    if (client || time) {
      // DISPATCH CUSTOM EVENT TO APP
      const event = new CustomEvent("jarvis-action", {
        detail: {
          type: "AGENDA_OPEN",
          payload: {
            clientName: client?.nome || "",
            time: time || "08:00",
            date: format(date, "yyyy-MM-dd")
          }
        }
      });
      window.dispatchEvent(event);
      finishCommandSession();
      
      // Voice Feedback (Simple)
      const utterance = new SpeechSynthesisUtterance("Com certeza. Abrindo agendamento.");
      utterance.lang = "pt-BR";
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!isSupported) return null;

  return (
    <>
      {/* Visual Feedback: Border Glow */}
      <div 
        className={cn(
          "fixed inset-0 pointer-events-none z-[9999] transition-all duration-1000 border-[0px]",
          isActive ? "border-brand-primary/30 shadow-[inset_0_0_100px_rgba(212,212,216,0.2)] border-[8px]" : "border-transparent"
        )}
      />

      {/* Subtle Floating Indicator (Optional) */}
      <div className={cn(
        "fixed bottom-24 right-8 z-[9999] transition-all duration-500",
        isActive ? "scale-100 opacity-100" : "scale-50 opacity-0 pointer-events-none"
      )}>
        <div className="bg-surface-section border border-brand-primary/20 p-4 rounded-full shadow-2xl flex items-center gap-3 animate-pulse">
          <div className="relative">
             <div className="absolute inset-0 bg-brand-primary/20 blur-xl rounded-full" />
             <Sparkles className="text-brand-primary relative" size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-brand-primary tracking-[0.2em]">Jarvis</span>
            <span className="text-[12px] font-bold text-white leading-none italic max-w-[150px] truncate">
              {lastTranscript || "Ouvindo..."}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
