"use client";

import { useState, FormEvent } from "react";

export default function UploadForm() {
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult("");

    const formData = new FormData();
    formData.append("prompt", prompt);
    if (file) formData.append("file", file);

    const res = await fetch("/api/generate", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();

    if (!json.success) {
      setResult(json.error || "Something went wrong");
    } else {
      setResult(JSON.stringify(json.data, null, 2));
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        className="w-full border rounded p-3"
        rows={4}
        placeholder="Describe the project or add extra instructions…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <input
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white px-6 py-2 rounded"
      >
        {loading ? "Generating..." : "Generate Project Plan"}
      </button>

      {result && (
        <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap">
          {result}
        </pre>
      )}
    </form>
  );
}
