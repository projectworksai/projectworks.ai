import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "ProjectWorksAI"
  }
});

async function callModel(model: string, prompt: string) {
  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `
You are a senior project manager.

Return ONLY valid JSON in this exact structure:

{
  "overview": "...",
  "scope": "...",
  "methodology": "...",
  "timeline": "...",
  "deliverables": "...",
  "risks": "...",
  "assumptions": "..."
}

No markdown.
No explanations.
Only JSON.
`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.4,
  });

  return response.choices[0].message.content;
}

export async function generateProjectPlan(prompt: string) {
  try {
    // Primary model
    return await callModel("anthropic/claude-3-haiku", prompt);
  } catch (err) {
    console.log("Primary failed. Switching model...");
    // Fallback model
    return await callModel("mistralai/mistral-7b-instruct", prompt);
  }
}
