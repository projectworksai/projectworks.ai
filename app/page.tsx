"use client";

import { useState, useCallback, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  getMainSectionsOnly,
  toSummary,
  getIndexContentForTable,
  parseIndexLine,
} from "@/lib/parser";
import { SECTION_DISPLAY_NAMES } from "@/lib/parser";
import { PRO_ONLY_SECTION_KEYS } from "@/lib/tiers";

const PRO_SECTION_NAMES = PRO_ONLY_SECTION_KEYS.map(
  (k) => SECTION_DISPLAY_NAMES[k] || k
);

export default function Home() {
  const { data: session, status, update } = useSession();
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tenderFile, setTenderFile] = useState<File | null>(null);
  const [technicalSpecFile, setTechnicalSpecFile] = useState<File | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingScheduleTarget, setDownloadingScheduleTarget] = useState<null | "msproject" | "primavera">(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authEmailConfirm, setAuthEmailConfirm] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatLastQuestion, setChatLastQuestion] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [generationMode, setGenerationMode] = useState<"preview" | "full" | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  type ProgressiveStep = "pending" | "loading" | "done" | "error";
  const PROGRESSIVE_SECTIONS = ["overview", "scope", "schedule", "resources", "procurement", "risk", "compliance"] as const;
  const [progressiveState, setProgressiveState] = useState<Record<string, ProgressiveStep>>({});
  const [progressiveData, setProgressiveData] = useState<Record<string, Record<string, unknown>>>({});
  const [useProgressive, setUseProgressive] = useState(true);

  const isPro = (session?.user as { plan?: string } | undefined)?.plan === "PRO";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const set = () => setIsMobile(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("upgraded") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
      void update();
    }
  }, [update]);

  const buildProjectPrompt = useCallback(() => {
    const parts = [
      projectName ? `Project name: ${projectName}` : "",
      client ? `Client: ${client}` : "",
      location ? `Location: ${location}` : "",
      prompt ? `Project brief:\n${prompt}` : "",
    ].filter(Boolean);
    return parts.join("\n\n");
  }, [projectName, client, location, prompt]);

  const generateProgressive = useCallback(async () => {
    const projectPrompt = buildProjectPrompt();
    if (!projectPrompt.trim()) {
      setError("Please enter a project brief or details.");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    setProgressiveData({});
    const initial: Record<string, ProgressiveStep> = {};
    PROGRESSIVE_SECTIONS.forEach((s) => (initial[s] = "pending"));
    setProgressiveState(initial);

    for (const section of PROGRESSIVE_SECTIONS) {
      setProgressiveState((prev) => ({ ...prev, [section]: "loading" }));
      try {
        const res = await fetch(`/api/generate/${section}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectPrompt }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          setProgressiveState((prev) => ({ ...prev, [section]: "error" }));
          setError(json?.message || json?.error || `Failed to generate ${section}`);
          break;
        }
        setProgressiveState((prev) => ({ ...prev, [section]: "done" }));
        setProgressiveData((prev) => ({ ...prev, [section]: (json.data ?? {}) as Record<string, unknown> }));
      } catch (e) {
        setProgressiveState((prev) => ({ ...prev, [section]: "error" }));
        setError(e instanceof Error ? e.message : `Failed to generate ${section}`);
        break;
      }
    }
    setLoading(false);
  }, [buildProjectPrompt]);

  const generate = useCallback(async () => {
    if (useProgressive) {
      await generateProgressive();
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    try {
      const formData = new FormData();
      formData.append("prompt", prompt);
      if (projectName) formData.append("projectName", projectName);
      if (client) formData.append("client", client);
      if (location) formData.append("location", location);
      if (tenderFile) formData.append("tenderDocument", tenderFile);
      if (technicalSpecFile) formData.append("technicalSpecification", technicalSpecFile);
      formData.append("mode", status === "authenticated" ? "full" : "preview");

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.success) {
        if (json?.code === "UPGRADE_REQUIRED" || res.status === 402) setShowUpgradeModal(true);
        const message = json?.message || json?.error || (typeof json === "string" ? json : "") || "Generation failed";
        throw new Error(message);
      }
      setGenerationMode((json.mode as "preview" | "full") || null);
      setData(json.data ?? {});
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [prompt, projectName, client, location, tenderFile, technicalSpecFile, status, useProgressive, generateProgressive]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        generate();
      }
    },
    [generate]
  );

  const downloadWord = useCallback(async () => {
    if (!data) return;
    setDownloading(true);
    setError("");
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: data, format: "docx" }),
      });
      const errData = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402) {
          setError("Pro subscription required. Upgrade to download.");
          return;
        }
        throw new Error(errData.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-plan-${(projectName || "export").replace(/[/\\?*:|"]/g, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }, [data, projectName]);

  const downloadScheduleCsv = useCallback(async (target: "msproject" | "primavera") => {
    if (!data) return;
    setDownloadingScheduleTarget(target);
    setError("");
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: data,
          format: "schedule_csv",
        }),
      });
      const errData = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 402) {
          setError("Pro subscription required. Upgrade to download.");
          return;
        }
        throw new Error(errData.error || "Schedule export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeBase = (projectName || "export").replace(/[/\\?*:|"]/g, "-");
      const suffix = target === "msproject" ? "-ms-project" : "-primavera";
      a.download = `project-schedule-${safeBase}${suffix}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule download failed");
    } finally {
      setDownloadingScheduleTarget(null);
    }
  }, [data, projectName]);

  const handleCheckout = useCallback(async () => {
    // For now, route users to a simple upgrade/pricing page.
    // Stripe checkout can be wired to this later.
    if (typeof window !== "undefined") {
      window.location.href = "/upgrade";
    }
  }, []);

  const handleSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const result = await signIn("credentials", {
        email: authEmail.trim().toLowerCase(),
        password: authPassword,
        redirect: false,
      });
      if (result?.error) {
        setAuthError("Invalid email or password");
        return;
      }
      setAuthMode(null);
      setAuthEmail("");
      setAuthPassword("");
    } catch {
      setAuthError("Sign in failed");
    } finally {
      setAuthLoading(false);
    }
  }, [authEmail, authPassword]);

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const email = authEmail.trim().toLowerCase();
    const emailConfirm = authEmailConfirm.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    if (email !== emailConfirm) {
      setAuthError("Email and confirmation email must match.");
      return;
    }
    const pwd = authPassword;
    const issues: string[] = [];
    if (pwd.length < 10) issues.push("at least 10 characters");
    if (!/[a-z]/.test(pwd)) issues.push("one lowercase letter");
    if (!/[A-Z]/.test(pwd)) issues.push("one uppercase letter");
    if (!/[0-9]/.test(pwd)) issues.push("one number");
    if (!/[^A-Za-z0-9]/.test(pwd)) issues.push("one symbol");
    if (issues.length) {
      setAuthError(`Password must include ${issues.join(", ")}.`);
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: pwd,
          name: authName.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(json.message || json.error || "We couldn't create your account. Please try again.");
        return;
      }
      const signInResult = await signIn("credentials", {
        email,
        password: pwd,
        redirect: false,
      });
      if (signInResult?.error) {
        setAuthError("Account created. Please sign in.");
        return;
      }
      setAuthMode(null);
      setAuthEmail("");
      setAuthEmailConfirm("");
      setAuthPassword("");
      setAuthName("");
    } catch {
      setAuthError("Sign up failed");
    } finally {
      setAuthLoading(false);
    }
  }, [authEmail, authPassword, authName]);

  const mainSections = data ? getMainSectionsOnly(data) : {};
  const hasSections = Object.keys(mainSections).length > 0;
  const hasProgressive = PROGRESSIVE_SECTIONS.some((s) => progressiveState[s] === "done" || progressiveState[s] === "loading");
  const sectionLabels: Record<string, string> = {
    overview: "Overview",
    scope: "Scope",
    schedule: "Schedule",
    resources: "Resources",
    procurement: "Procurement",
    risk: "Risk",
    compliance: "Compliance",
  };

  const handleChatSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setChatError("");
      const q = chatQuestion.trim();
      if (!q) {
        setChatError("Please type a question.");
        return;
      }
      setChatLoading(true);
      setChatAnswer("");
      setChatLastQuestion(q);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || "Chat assistant is unavailable.");
        }
        setChatAnswer(json.answer || "");
        setChatQuestion("");
      } catch (err) {
        setChatError(
          err instanceof Error && err.name === "AbortError"
            ? "The assistant is taking longer than expected. Please try again in a moment."
            : err instanceof Error
            ? err.message
            : "Chat assistant is unavailable."
        );
      } finally {
        setChatLoading(false);
      }
    },
    [chatQuestion]
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
        fontFamily: "var(--font-dm-sans), 'DM Sans', system-ui, sans-serif",
        color: "#0f172a",
        position: "relative",
      }}
    >
      <header
        style={{
          padding: isMobile ? "14px 16px" : "20px 24px",
          borderBottom: "1px solid #e2e8f0",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: isMobile ? "1.25rem" : "1.5rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em", color: "#0f172a" }}>
            Plan Forge
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "4px 0 0 0" }}>
            Turn tenders and specs into world‑class project plans
          </p>
        </div>
        {status === "authenticated" && session?.user && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 20,
                background: isPro ? "#0ea5e9" : "#e2e8f0",
                color: isPro ? "#fff" : "#475569",
              }}
            >
              {isPro ? "Pro" : "Free"}
            </span>
            <span style={{ fontSize: 13, color: "#475569" }}>
              {session.user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              style={{
                fontSize: 12,
                color: "#64748b",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: isMobile ? "16px 16px 72px 16px" : 24,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "340px 1fr",
          gap: isMobile ? 20 : 24,
          alignItems: "start",
        }}
      >
        {/* Left column: Auth + Inputs — appears first on mobile */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            order: isMobile ? 1 : undefined,
          }}
        >
          {/* Auth card */}
          <section
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              border: "1px solid #e2e8f0",
            }}
          >
            <h2 style={{ fontSize: "0.9rem", fontWeight: 600, color: "#0f172a", margin: "0 0 12px 0" }}>
              Account
            </h2>
            {status === "loading" ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>Loading…</p>
            ) : status === "authenticated" ? (
              <div>
                <p style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>
                  Signed in. {!isPro && "Upgrade to Pro for full plans and Word export."}
                </p>
                {!isPro && (
                  <button
                    type="button"
                    onClick={handleCheckout}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Upgrade to Pro
                  </button>
                )}
              </div>
            ) : (
              <div>
                {authMode === null ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#0f172a",
                        background: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode("signup")}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#fff",
                        background: "#0f172a",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Sign up
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={authMode === "signin" ? handleSignIn : handleSignUp}
                    style={{ display: "flex", flexDirection: "column", gap: 12 }}
                  >
                    {authMode === "signup" && (
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>Name</label>
                        <input
                          type="text"
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          placeholder="Your name"
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "8px 10px",
                            fontSize: 13,
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    )}
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>Email</label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "8px 10px",
                          fontSize: 13,
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          fontFamily: "inherit",
                        }}
                      />
                    </div>
                    {authMode === "signup" && (
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>Confirm email</label>
                        <input
                          type="email"
                          value={authEmailConfirm}
                          onChange={(e) => setAuthEmailConfirm(e.target.value)}
                          placeholder="Repeat your email"
                          required
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "8px 10px",
                            fontSize: 13,
                            border: "1px solid #e2e8f0",
                            borderRadius: 6,
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    )}
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>Password</label>
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder={authMode === "signup" ? "Min. 8 characters" : "••••••••"}
                        required
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "8px 10px",
                          fontSize: 13,
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          fontFamily: "inherit",
                        }}
                      />
                      {authMode === "signup" && (
                        <p style={{ marginTop: 4, fontSize: 11, color: "#94a3b8" }}>
                          Use at least 10 characters, including upper & lower case letters, a number, and a symbol.
                        </p>
                      )}
                    </div>
                    {authError && (
                      <p style={{ fontSize: 12, color: "#b91c1c" }}>{authError}</p>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="submit"
                        disabled={authLoading}
                        style={{
                          flex: 1,
                          padding: "10px 12px",
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#fff",
                          background: "#0f172a",
                          border: "none",
                          borderRadius: 8,
                          cursor: authLoading ? "wait" : "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {authLoading ? "…" : authMode === "signin" ? "Sign in" : "Create account"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode(null);
                          setAuthError("");
                        }}
                        style={{
                          padding: "10px 12px",
                          fontSize: 13,
                          color: "#64748b",
                          background: "none",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </section>

          {/* Inputs */}
          <section
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              border: "1px solid #e2e8f0",
            }}
          >
            <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a", margin: "0 0 4px 0" }}>
              Project
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 20px 0" }}>
              Brief and documents. Press Generate or Ctrl+Enter to create your plan.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>Project name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. MRWA Pavement Repair"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    fontSize: 13,
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>Client</label>
                <input
                  type="text"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="e.g. Main Roads WA"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    fontSize: 13,
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#64748b", marginBottom: 4 }}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Perth Metro"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px",
                  fontSize: 13,
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  fontFamily: "inherit",
                }}
              />
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 6 }}>
              Project brief
            </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste or type your project brief..."
              rows={5}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                fontSize: 14,
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                resize: "vertical",
                marginBottom: 16,
                fontFamily: "inherit",
              }}
            />

            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 6 }}>
              Tender document
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setTenderFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 12 }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>{tenderFile ? tenderFile.name : "—"}</span>
              {tenderFile && (
                <button
                  type="button"
                  onClick={() => setTenderFile(null)}
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              )}
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 6 }}>
              Technical specification
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setTechnicalSpecFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 12 }}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>{technicalSpecFile ? technicalSpecFile.name : "—"}</span>
              {technicalSpecFile && (
                <button
                  type="button"
                  onClick={() => setTechnicalSpecFile(null)}
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: loading ? "#94a3b8" : "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
                border: "none",
                borderRadius: 8,
                cursor: loading ? "wait" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {loading ? "Generating…" : "Generate project plan"}
            </button>

            {error && (
              <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 12 }}>{error}</p>
            )}
          </section>
        </div>

        {/* Right: Output — full width on mobile, clearly separated */}
        <section
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: isMobile ? 16 : 24,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            border: "1px solid #e2e8f0",
            minHeight: isMobile ? 320 : 400,
            display: "flex",
            flexDirection: "column",
            order: isMobile ? 2 : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a", margin: 0 }}>
              Output
            </h2>
            {hasSections && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {isPro ? (
                  <>
                    <button
                      type="button"
                      onClick={downloadWord}
                      disabled={downloading}
                      style={{
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#fff",
                        background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
                        border: "none",
                        borderRadius: 6,
                        cursor: downloading ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {downloading ? "Preparing…" : "Download Word"}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadScheduleCsv("msproject")}
                      disabled={downloadingScheduleTarget !== null}
                      style={{
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#0f172a",
                        background: "#e5f0ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: 6,
                        cursor: downloadingScheduleTarget !== null ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {downloadingScheduleTarget === "msproject"
                        ? "Preparing…"
                        : "Open in MS Project"}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadScheduleCsv("primavera")}
                      disabled={downloadingScheduleTarget !== null}
                      style={{
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#0f172a",
                        background: "#eefcf3",
                        border: "1px solid #bbf7d0",
                        borderRadius: 6,
                        cursor: downloadingScheduleTarget !== null ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {downloadingScheduleTarget === "primavera"
                        ? "Preparing…"
                        : "Open in Primavera"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleCheckout}
                    style={{
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#0ea5e9",
                      background: "#f0f9ff",
                      border: "1px solid #bae6fd",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Upgrade to Pro to download
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflow: "auto", fontSize: 13, lineHeight: 1.55 }}>
            {loading && !hasProgressive && (
              <div style={{ color: "#94a3b8", fontSize: 14 }}>
                Working on a detailed project plan for you&mdash;sit back for a moment while we map out the scope,
                risks, and timeline.
              </div>
            )}
            {hasProgressive && (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {PROGRESSIVE_SECTIONS.map((key) => {
                    const st = progressiveState[key];
                    const label = sectionLabels[key];
                    return (
                      <span
                        key={key}
                        style={{
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: st === "done" ? "#dcfce7" : st === "loading" ? "#fef3c7" : st === "error" ? "#fee2e2" : "#f1f5f9",
                          color: st === "done" ? "#166534" : st === "loading" ? "#92400e" : st === "error" ? "#b91c1c" : "#64748b",
                        }}
                      >
                        {st === "done" ? "✔ " : st === "loading" ? "⏳ " : st === "error" ? "✗ " : "○ "}
                        {label}
                      </span>
                    );
                  })}
                </div>
                {PROGRESSIVE_SECTIONS.filter((s) => progressiveState[s] === "done").map((key) => {
                  const d = progressiveData[key];
                  if (!d || typeof d !== "object") return null;
                  const label = sectionLabels[key];
                  let content: React.ReactNode;
                  if (key === "overview") {
                    const summary = d.summary != null ? String(d.summary) : "";
                    const objectives = Array.isArray(d.objectives) ? d.objectives : [];
                    const budget = d.budgetEstimate != null ? String(d.budgetEstimate) : "";
                    const duration = d.durationWeeks != null ? String(d.durationWeeks) : "";
                    content = (
                      <>
                        {summary && <p style={{ margin: "0 0 8px 0" }}>{summary}</p>}
                        {objectives.length > 0 && (
                          <>
                            <p style={{ margin: "0 0 4px 0", fontWeight: 600 }}>Objectives</p>
                            <ul style={{ margin: "0 0 8px 0", paddingLeft: 18 }}>{objectives.map((o: unknown, i: number) => <li key={i}>{String(o)}</li>)}</ul>
                          </>
                        )}
                        {(budget || duration) && (
                          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                            {budget && <span>Budget: {budget}</span>}
                            {budget && duration && " · "}
                            {duration && <span>Duration: {duration} weeks</span>}
                          </p>
                        )}
                      </>
                    );
                  } else if (key === "risk" && Array.isArray(d.risks)) {
                    content = (
                      <>
                        {(d.overallRiskSummary as string) && <p style={{ margin: "0 0 8px 0" }}>{String(d.overallRiskSummary)}</p>}
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {d.risks.slice(0, 10).map((r: Record<string, unknown>, i: number) => (
                            <li key={i} style={{ marginBottom: 4 }}>
                              {r.description as string} — {r.likelihood as string}/{r.impact as string}. Mitigation: {r.mitigation as string}
                            </li>
                          ))}
                        </ul>
                      </>
                    );
                  } else {
                    content = <div style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(d, null, 2)}</div>;
                  }
                  return (
                    <div key={key} style={{ marginBottom: 16, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <h3 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600 }}>{label}</h3>
                      <div style={{ fontSize: 12, color: "#334155" }}>{content}</div>
                    </div>
                  );
                })}
              </>
            )}
            {!hasSections && !hasProgressive && !loading && (
              <div style={{ color: "#94a3b8", fontSize: 14 }}>
                Your plan summary will appear here after generation.
              </div>
            )}
            {hasSections && !hasProgressive && generationMode === "preview" && (
              <div
                style={{
                  padding: 12,
                  marginBottom: 12,
                  borderRadius: 8,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  fontSize: 12,
                  color: "#1d4ed8",
                }}
              >
                This is a preview of your project plan. Create a free account to unlock the full execution plan,
                including detailed tasks, dependencies, procurement, and compliance checklists.
              </div>
            )}
            {hasSections && !hasProgressive &&
              Object.entries(mainSections).map(([title, text]) => {
                const isIndex = title === "Index";
                const indexContent = isIndex ? getIndexContentForTable(text) : "";
                const indexRows = isIndex && indexContent
                  ? indexContent.split(/\r?\n/).filter((line) => line.trim())
                  : [];
                const hasIndexTable = isIndex && indexRows.length > 0;
                const isExpanded = expandedSections[title] ?? isIndex;
                const toggle = () => setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
                const summary = isIndex ? (indexRows.length ? "Table of contents" : "—") : toSummary(text);
                const isLockedSection =
                  generationMode === "preview" &&
                  !isIndex &&
                  title !== "Background" &&
                  title !== "Scope";

                if (generationMode === "preview" && isLockedSection) {
                  return null;
                }
                return (
                  <div key={title} style={{ marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
                    <button
                      type="button"
                      onClick={toggle}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "8px 0",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0f172a",
                        textAlign: "left",
                      }}
                    >
                      <span>{title}</span>
                      <span style={{ fontSize: 18, color: "#64748b" }}>{isExpanded ? "−" : "+"}</span>
                    </button>
                    {isExpanded && (
                      <div style={{ paddingTop: 4 }}>
                        {hasIndexTable ? (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#475569", width: 40 }}>No.</th>
                                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#475569" }}>Section</th>
                                <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#475569", width: 56 }}>Page</th>
                              </tr>
                            </thead>
                            <tbody>
                              {indexRows.map((line, i) => {
                                const { num, section, page } = parseIndexLine(line, i);
                                return (
                                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{num}</td>
                                    <td style={{ padding: "8px 10px", color: "#0f172a" }}>{section}</td>
                                    <td style={{ padding: "8px 10px", color: "#64748b", textAlign: "right" }}>{page}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ whiteSpace: "pre-wrap", color: "#334155", fontSize: 13 }}>
                            {isIndex ? (indexContent || "—") : text}
                          </div>
                        )}
                      </div>
                    )}
                    {!isExpanded && (
                      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{summary}</div>
                    )}
                  </div>
                );
              })}
            {hasSections && !hasProgressive && !isPro && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  background: "#f8fafc",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: "#334155", margin: "0 0 8px 0" }}>
                  Pro unlocks: {PRO_SECTION_NAMES.slice(0, 4).join(", ")}…
                </p>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  Upgrade for Quality, Risk, Safety, Schedule, appendices, and Word download.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
      {showUpgradeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#ffffff",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 20px 45px rgba(15,23,42,0.35)",
              border: "1px solid #e2e8f0",
            }}
          >
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: 18, fontWeight: 600, color: "#0f172a" }}>
              Unlock unlimited execution plans
            </h2>
            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#475569" }}>
              You&apos;ve used your free full project generation. Upgrade to continue generating detailed execution
              plans, export Word/PDF, and download schedules for MS Project and Primavera.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/pricing#pro";
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "none",
                  background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
                  color: "#f9fafb",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Upgrade to Pro ($29/month)
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/pricing#team";
                }}
                style={{
                  padding: "9px 14px",
                  borderRadius: 999,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#0f172a",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Upgrade to Team ($99/month)
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowUpgradeModal(false)}
              style={{
                marginTop: 4,
                border: "none",
                background: "none",
                color: "#64748b",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Maybe later
            </button>
          </section>
        </div>
      )}
      {/* Chat assistant — avoid overlapping content on mobile */}
      <div
        style={{
          position: "fixed",
          right: isMobile ? 12 : 24,
          bottom: isMobile ? 12 : 24,
          zIndex: 40,
        }}
      >
        {!chatOpen ? (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            style={{
              padding: isMobile ? "8px 12px" : "10px 14px",
              borderRadius: 999,
              border: "none",
              background: "#0f172a",
              color: "#f9fafb",
              fontSize: isMobile ? 12 : 13,
              fontWeight: 500,
              boxShadow: "0 10px 25px rgba(15,23,42,0.35)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {isMobile ? "Assistant" : "Ask ProjectWorks assistant"}
          </button>
        ) : (
          <section
            style={{
              width: isMobile ? "calc(100vw - 24px)" : 320,
              maxWidth: isMobile ? 400 : 320,
              maxHeight: isMobile ? "70vh" : 420,
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              boxShadow: "0 18px 45px rgba(15,23,42,0.18)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <header
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>ProjectWorks assistant</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  Ask about the app or project management.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 16,
                  color: "#94a3b8",
                }}
              >
                ×
              </button>
            </header>
            <div
              style={{
                padding: "10px 14px",
                flex: 1,
                overflow: "auto",
                fontSize: 13,
                color: "#0f172a",
              }}
            >
              {!chatAnswer && !chatError && (
                <p style={{ margin: 0, color: "#64748b" }}>
                  Examples: &quot;How do I generate a plan from a PDF tender?&quot; or &quot;How should I phase a
                  pavement rehab project?&quot;
                </p>
              )}
              {chatLastQuestion && (
                <p style={{ margin: "0 0 6px 0", fontSize: 12, color: "#0f172a" }}>
                  <strong>You:</strong> {chatLastQuestion}
                </p>
              )}
              {chatAnswer && (
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  <strong>Assistant:</strong> {chatAnswer}
                </p>
              )}
              {chatError && (
                <p style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>{chatError}</p>
              )}
            </div>
            <form
              onSubmit={handleChatSubmit}
              style={{
                padding: "8px 10px 10px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <textarea
                rows={2}
                value={chatQuestion}
                onChange={(e) => setChatQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!chatLoading) {
                      void handleChatSubmit(e);
                    }
                  }
                }}
                placeholder="Ask a question…"
                style={{
                  resize: "none",
                  fontSize: 13,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontFamily: "inherit",
                }}
              />
              <button
                type="submit"
                disabled={chatLoading}
                style={{
                  alignSelf: "flex-end",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 500,
                  background: chatLoading ? "#cbd5e1" : "#0f172a",
                  color: "#f9fafb",
                  cursor: chatLoading ? "wait" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {chatLoading ? "Thinking…" : "Send"}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
