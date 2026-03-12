import { NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are the assistant for ProjectWorks.ai (Plan Forge).
Your role is to:
- Answer questions about how to use the app (plans, exports, Pro vs Free, etc.).
- Help with practical project management questions (scheduling, risk, construction methodology), but keep answers concise and pragmatic.
- When something requires legal, commercial, or safety sign-off, remind the user to confirm with their organisation's processes.

Keep answers clear, short, and non-technical unless the user asks for detail.`;

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  const provider = process.env.AI_PROVIDER || "openai";
  if (provider !== "openai" || !key) {
    throw new Error("AI_PROVIDER must be 'openai' and OPENAI_API_KEY must be set");
  }
  return new OpenAI({ apiKey: key });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const question = (body?.question as string | undefined)?.trim();

    if (!question) {
      return NextResponse.json(
        { success: false, message: "Please enter a question for the assistant." },
        { status: 400 }
      );
    }

    const client = getClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: question },
      ],
      temperature: 0.4,
    });

    const answer = completion.choices?.[0]?.message?.content || "";
    return NextResponse.json({ success: true, answer });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Chat assistant is currently unavailable.";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

