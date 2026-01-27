"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function ProjectWorksLanding() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generatePlan = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setResult("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      setResult(data.result || "No output generated.");
    } catch (err) {
      setResult("Error generating project plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
      <h1>Generate Project Plan</h1>

      <textarea
        rows={8}
        style={{ width: "100%", padding: 10, marginBottom: 12 }}
        placeholder="Paste project requirements or bidding document text here..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <button
        onClick={generatePlan}
        disabled={loading}
        style={{
          padding: "10px 20px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        {loading ? "Generating..." : "Generate Project Plan"}
      </button>

      {result && (
        <section style={{ marginTop: 40 }}>
          <ReactMarkdown>{result}</ReactMarkdown>
        </section>
      )}
    </main>
  );
}
