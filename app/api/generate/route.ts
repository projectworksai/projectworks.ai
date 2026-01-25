import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a senior project manager and delivery consultant.

Generate a COMPLETE professional project plan with these sections:

1. Project Overview
2. Objectives & Success Criteria
3. Methodology (Agile / Waterfall / Hybrid)
4. Scope (In-Scope / Out-of-Scope)
5. Deliverables
6. Milestones & Schedule
7. Budget Estimate
8. Resource Plan
9. Risk Management Plan
10. Quality Management Plan
11. Stakeholder Management Plan
12. Communication Plan
13. Assumptions & Constraints

Use clear headings and bullet points.
Write in a professional, client-ready tone.
          `.trim(),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1800,
    });

    return NextResponse.json({
      result: completion.choices[0].message.content,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to generate project plan" },
      { status: 500 }
    );
  }
}
