"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await res.json().catch(() => ({}));
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: "#0f172a",
        padding: "32px 16px 48px",
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          maxWidth: 760,
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 10px 30px rgba(15,23,42,0.10)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.65rem", letterSpacing: "-0.03em" }}>
          Forgot your password?
        </h1>
        <p style={{ margin: "10px 0 0 0", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
          Enter your account email and we’ll send you a password reset link.
        </p>

        <form onSubmit={submit} style={{ marginTop: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              fontSize: 14,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              fontFamily: "inherit",
            }}
          />
          {sent && (
            <p style={{ margin: "10px 0 0 0", fontSize: 13, color: "#166534" }}>
              If an account exists for that email, a reset link has been sent.
            </p>
          )}
          {error && (
            <p style={{ margin: "10px 0 0 0", fontSize: 13, color: "#b91c1c" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              background: "#0f172a",
              color: "#fff",
              border: "none",
              cursor: loading ? "wait" : "pointer",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "9px 12px",
              borderRadius: 10,
              background: "#0f172a",
              color: "#fff",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Back to Plan Forge
          </a>
          <a
            href="/pricing"
            style={{
              display: "inline-block",
              padding: "9px 12px",
              borderRadius: 10,
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              color: "#0ea5e9",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            View pricing
          </a>
        </div>
      </section>
    </main>
  );
}

