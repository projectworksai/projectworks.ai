"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function ProjectWorksLanding(): JSX.Element {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generatePlan = async () => {
    setLoading(true);
    setResult("");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    setResult(data.result || "No output generated");
    setLoading(false);
  };

  return (
    <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: 32, marginBottom: 20 }}>
        Generate Project Plan
      </h1>

      <textarea
        rows={6}
        style={{ width: "100%", padding: 10 }}
        placeholder="Describe the project requirements..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <br />

      <button
        onClick={generatePlan}
        disabled={loading}
        style={{
          marginTop: 15,
          padding: "10px 20px",
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        {loading ? "Generating..." : "Generate Project Plan"}
      </button>

      {result && (
        <div
          style={{
            marginTop: 30,
            padding: 20,
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#ffffff",
          }}
        >
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
