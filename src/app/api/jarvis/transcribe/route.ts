import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const groqFormData = new FormData();
    groqFormData.append('file', file);
    groqFormData.append('model', 'whisper-large-v3-turbo');
    groqFormData.append('language', 'pt'); // Força interpretação em pt-br para melhor performance e menos alucinações

    console.log(`[Jarvis Whisper] Enviando áudio de tamanho ${file.size} para a Groq...`);

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: groqFormData
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Jarvis Whisper Error Groq]: ", err);
      return NextResponse.json({ error: "Failed to fetch from Groq Whisper" }, { status: response.status });
    }

    const data = await response.json();
    console.log("[Jarvis Whisper Sucesso]:", data);
    return NextResponse.json({ text: data.text });

  } catch (error: any) {
    console.error("[Jarvis Whisper System Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
