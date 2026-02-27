import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { command, currentDate } = await req.json();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini", // Modelo extremamente preciso e rápido
        messages: [
          {
            role: "system",
            content: `Você é o "Jarvis", o assistente inteligente de uma barbearia.
Seu trabalho é interpretar o comando de voz do barbeiro e extrair as intenções para retorná-las em formato JSON EXATO e PURO (sem blocos markdown, sem backticks \`\`\`json).

Data atual (hoje com dia da semana): ${currentDate}.
Atenção: Se o cliente pedir "próxima sexta" ou "sexta" e hoje for sexta-feira, significa que ele quer exatamente daqui a 7 dias. Se pedir um dia da semana que ainda vai acontecer nesta semana, agende para a semana corrente. Siga a lógica rigorosamente na data de "date".

O JSON deve conter:
{
  "intent": "agendar", // Preencha "agendar" se a intenção for marcar horário, ou "desconhecida" caso contrário
  "clientName": "João Lucas", // Nome completo EXATAMENTE como o usuário falou. Nunca abrevie ou resuma o nome. null se não achou.
  "time": "16:00", // Horário (HH:MM de 00:00 a 23:59). Entenda "quatro da tarde" como "16:00", "meia" como ":30". null se não achou
  "date": "2026-02-28", // Calcule a data alvo no formato YYYY-MM-DD (ex: "amanhã", "depois de amanhã"). null se não achou
  "spokenTime": "dezesseis horas", // O horário formato em PT-BR amigável para a voz do assistente falar. (Ex: "duas e meia da tarde", "oito da noite", "dez horas").
  "spokenDate": "amanhã" // A data em PT-BR para a voz do assistente falar. (Ex: "amanhã", "depois de amanhã", "próxima quarta-feira", "dia 15 de abril").
}

Retorne APENAS o objeto JSON, sem nenhum texto adicional e sem marcação markdown.`
          },
          {
            role: "user",
            content: command
          }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter Error: ", err);
      return NextResponse.json({ error: "Failed to fetch from OpenRouter" }, { status: response.status });
    }

    const data = await response.json();
    let resultText = data.choices[0].message.content.trim();
    
    // Limpando blocos markdown acidentais da IA
    if (resultText.startsWith("```json")) {
      resultText = resultText.replace(/```json/gi, "").replace(/```/g, "").trim();
    } else if (resultText.startsWith("```")) {
      resultText = resultText.replace(/```/g, "").trim();
    }

    const parsed = JSON.parse(resultText);
    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error("Jarvis Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
