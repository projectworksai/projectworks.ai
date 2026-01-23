'use client';

import { useState } from 'react';

export default function ProjectWorksLanding() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function generatePlan() {
    if (!prompt) return;

    setLoading(true);
    setResult('');

    const res = await fetch('/api/generateProjectPlan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    setResult(data.text);
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 900, margin: 'auto', padding: 40 }}>
      <h1>ProjectWorks AI</h1>

      <textarea
        rows={4}
        placeholder="Describe your project (e.g. build a fintech app using Agile)"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        style={{ width: '100%', padding: 12 }}
      />

      <button onClick={generatePlan} disabled={loading} style={{ marginTop: 12 }}>
        {loading ? 'Generating...' : 'Generate Project Plan'}
      </button>

      {result && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 24 }}>
          {result}
        </pre>
      )}
    </main>
  );
}
