import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const systemPrompt = `
You are a senior project manager.
Generate a complete professional project plan with:
- Objectives
- Scope
- Methodology
- Schedule
- Budget
- Quality Management Plan
- Risk Management Plan
- Stakeholder Management Plan
- Communication & Procurement Plan
Use clear headings.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
    });

    return NextResponse.json({
      text: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'AI generation failed' },
      { status: 500 }
    );
  }
}
