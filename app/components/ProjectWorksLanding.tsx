"use client";

import { useState } from "react";

export default function ProjectWorksLanding() {
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setOutput("");

    const formData = new FormData();
    formData.append("prompt", prompt);
    if (file) formData.append("file", file);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setOutput(data.output || data.error || "No output");
    } catch (err: any) {
      setOutput(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 800 }}>
      <h1>ProjectWorks AI</h1>

      <textarea
        placeholder="Type your project requirements or tender summary…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={6}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <br />
      <br />

      <button onClick={generate} disabled={loading}>
        {loading ? "Generating..." : "Generate Project Plan"}
      </button>

      <div
        style={{
          marginTop: 20,
          padding: 20,
          background: "#f7f7f7",
          borderRadius: 6,
          whiteSpace: "pre-wrap",
          fontFamily: "monospace",
        }}
      >
        {output}
      </div>
    </div>
  );
}
