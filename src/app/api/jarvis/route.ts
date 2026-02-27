import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";

// Inicializa o Supabase com as variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { command, currentDate } = await req.json();

    // 1. Primeiro passo: Entender a intenção e extrair dados básicos (Data, Cliente, etc)
    const analyzerPrompt = `Você é o analisador do "Jarvis".
Analise o comando: "${command}".
Data atual de referência: ${currentDate}.

Objetivo: Identificar a intenção e a data alvo.
Intenções: 
- "agendar", "navegar", "mudar_data", "editar", "deletar", "bulk_action"
- "consultar_agenda" (Se o usuário perguntar por horários, vagas, quem está agendado, o que tem pra hoje)
- "consultar_saidas" (Se perguntar sobre gastos, lucro, contas)
- "desconhecida"

Retorne APENAS um JSON:
{
  "intent": string,
  "date": "YYYY-MM-DD" | null,
  "clientName": string | null
}`;

    const analyzerRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "system", content: analyzerPrompt }, { role: "user", content: command }]
      })
    });

    const analyzerData = await analyzerRes.json();
    let analyzerContent = analyzerData.choices[0].message.content.trim();
    if (analyzerContent.includes("```")) analyzerContent = analyzerContent.replace(/```json/gi, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(analyzerContent);

    let dbContext = "";

    // 2. Busca dados se necessário
    if (analysis.intent === "consultar_agenda" && analysis.date) {
      const { data: appts } = await supabase
        .from('agendamentos')
        .select('horario, cliente, procedimento')
        .eq('data', analysis.date);
      
      if (appts && appts.length > 0) {
        dbContext = `\nCONTEXTO DO BANCO DE DADOS (Agendamentos em ${analysis.date}):\n` + 
                    appts.map(a => `- ${a.horario}: ${a.cliente} (${a.procedimento})`).join("\n");
      } else {
        dbContext = `\nCONTEXTO DO BANCO DE DADOS: Não há nenhum agendamento para o dia ${analysis.date}. O dia está totalmente livre.`;
      }
    } else if (analysis.intent === "consultar_saidas") {
      const { data: out } = await supabase.from('saidas').select('valor, descricao, paga, vencimento');
      if (out) {
        dbContext = `\nCONTEXTO DO BANCO DE DADOS (Saídas): Total de ${out.length} registros. Resumo: ${out.slice(0, 10).map(s => `${s.descricao}: R$${s.valor}`).join(", ")}...`;
      }
    }

    // 3. Resposta Final (Inteligência Completa)
    const finalSystemPrompt = `Você é o "Jarvis", o assistente inteligente de uma barbearia premium.
Seu trabalho é interpretar o comando e retornar um JSON puro.

Regras de Negócio (Horários):
- Funcionamento: 07:20 às 20:40.
- Intervalo (Almoço): 12:00 às 13:00 (Não agendar).
- Duração padrão: 40 minutos por corte.
- Horários padrão: 07:20, 08:00, 08:40, 09:20, 10:00, 10:40, 11:20, 13:00, 13:40, 14:20, 15:00, 15:40, 16:20, 17:00, 17:40, 18:20, 19:00, 19:40, 20:20.

Data atual: ${currentDate}.
${dbContext}

Se o usuário der uma ordem clara de agendamento (Ex: "Agendar cliente X as 10h"), priorize a intenção "agendar". SÓ recuse se o horário estiver ocupado no contexto abaixo.

Regras de Datas:
- Seja LITERAL. Se o usuário pediu dia 3 de Janeiro, agende para dia 3 de Janeiro. NÃO confunda com o dia 1.
- Feriados Fechados: 01 de Janeiro (Confraternização Universal), 25 de Dezembro (Natal), 01 de Maio (Trabalhador).

JSON esperado:
{
  "intent": "agendar" | "navegar" | "mudar_data" | "editar" | "deletar" | "bulk_action" | "conversar" | "desconhecida",
  "clientName": string | null,
  "time": "HH:MM" | null,
  "date": "YYYY-MM-DD" | null,
  "path": string | null,
  "id": string | null,
  "updates": { "time"?: string, "clientName"?: string, "service"?: string } | null,
  "action": string | null,
  "sourceMonth": number | null,
  "targetMonth": number | null,
  "targetTable": string | null,
  "needsConfirmation": boolean,
  "spokenResponse": "string",
  "availableSlots": string[] | null 
}

No spokenResponse, cite EXATAMENTE o dia e hora que foi agendado. Ex: "Agendado para 03 de Janeiro às 20:20".
Use um tom Premium, Ágil e Amigável.`;

    const finalRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: finalSystemPrompt },
          { role: "user", content: command }
        ]
      })
    });

    if (!finalRes.ok) throw new Error("Falha na IA final");

    const finalData = await finalRes.json();
    let finalResult = finalData.choices[0].message.content.trim();
    if (finalResult.includes("```")) finalResult = finalResult.replace(/```json/gi, "").replace(/```/g, "").trim();

    return NextResponse.json(JSON.parse(finalResult));

  } catch (error: any) {
    console.error("Jarvis Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
