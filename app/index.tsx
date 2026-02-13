import React, { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const formData = new FormData();
      formData.append("prompt", prompt);
      if (file) formData.append("file", file);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setData(result.data);
    } catch (err: any) {
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>ProjectWorks.ai</h1>

      <textarea
        placeholder="Describe your project..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <br /><br />

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Generating..." : "Generate Project Plan"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {data && (
        <div style={{ marginTop: "40px" }}>
          {Object.entries(data).map(([key, value]) => (
            <div
              key={key}
              style={{
                border: "1px solid #ddd",
                padding: "20px",
                marginBottom: "20px",
                borderRadius: "8px",
              }}
            >
              <h3>{key.toUpperCase()}</h3>
              <p>{value as string}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
