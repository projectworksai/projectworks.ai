"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function ResetPasswordInner() {
  const params = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Missing reset token.");
      return;
    }
    if (pw !== pw2) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setError(json?.message || "Could not reset password.");
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
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
          Set a new password
        </h1>
        <p style={{ margin: "10px 0 0 0", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
          Choose a strong password (10+ characters with upper/lower case, a number, and a symbol).
        </p>

        {done ? (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <p style={{ margin: 0, color: "#166534", fontWeight: 700 }}>Password updated.</p>
            <p style={{ margin: "6px 0 0 0", color: "#166534", fontSize: 13 }}>
              You can now sign in with your new password.
            </p>
            <a
              href="/"
              style={{
                display: "inline-block",
                marginTop: 12,
                padding: "9px 12px",
                borderRadius: 10,
                background: "#0f172a",
                color: "#fff",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Back to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={submit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                New password
              </label>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
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
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                Confirm new password
              </label>
              <input
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
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
            </div>
            {error && <p style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
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
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
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
              Set a new password
            </h1>
            <p style={{ margin: "10px 0 0 0", color: "#64748b", fontSize: 14 }}>
              Loading…
            </p>
          </section>
        </main>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

