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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "40px 24px",
        background:
          "radial-gradient(circle at top left, #f4f7ff 0, #ffffff 45%, #f5f5f7 100%)",
        boxSizing: "border-box",
        fontFamily:
          '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          backgroundColor: "white",
          borderRadius: 16,
          boxShadow:
            "0 18px 45px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(148, 163, 184, 0.18)",
          padding: 28,
          boxSizing: "border-box",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                letterSpacing: "-0.03em",
                color: "#020617",
              }}
            >
              Plan Forge for Project Leaders
            </h1>
            <p
              style={{
                marginTop: 8,
                marginBottom: 0,
                maxWidth: 520,
                fontSize: 14,
                lineHeight: 1.6,
                color: "#475569",
              }}
            >
              Turn tenders, briefs, and specs into board‑ready project plans in
              minutes&mdash;with clear scopes, milestones, and resourcing.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              style={{
                padding: "8px 16px",
                fontSize: 13,
                borderRadius: 999,
                border: "1px solid #E2E8F0",
                backgroundColor: "white",
                color: "#0F172A",
                cursor: "pointer",
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              style={{
                padding: "8px 18px",
                fontSize: 13,
                borderRadius: 999,
                border: "none",
                background:
                  "linear-gradient(135deg, #0F172A 0%, #111827 45%, #1D4ED8 100%)",
                color: "white",
                cursor: "pointer",
                boxShadow: "0 10px 25px rgba(15, 23, 42, 0.35)",
              }}
            >
              Get started free
            </button>
          </div>
        </header>

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 24,
            alignItems: "stretch",
            flexWrap: "wrap",
          }}
        >
          {/* Left column: Project brief + inputs */}
          <section
            aria-label="Project brief"
            style={{
              flex: "1 1 320px",
              minWidth: 0,
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              padding: 16,
              boxSizing: "border-box",
              background:
                "radial-gradient(circle at top left, #EEF2FF 0, #F8FAFC 45%, #FFFFFF 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
                gap: 8,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 14,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#64748B",
                  }}
                >
                  Project brief
                </h2>
                <p
                  style={{
                    margin: 4,
                    marginLeft: 0,
                    fontSize: 12,
                    color: "#6B7280",
                  }}
                >
                  Paste your tender, scope, or requirements. You can also attach
                  a PDF or Word document.
                </p>
              </div>
            </div>

            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 13,
                color: "#0F172A",
                marginBottom: 10,
              }}
            >
              <span>Project context</span>
              <textarea
                placeholder="Example: Design and deliver a staged upgrade of MRWA pavements across Perth Metro, including traffic management, stakeholder engagement, and construction staging..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                style={{
                  width: "100%",
                  resize: "vertical",
                  minHeight: 150,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #CBD5E1",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#0F172A",
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "rgba(248, 250, 252, 0.6)",
                }}
              />
            </label>

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  color: "#4B5563",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                Attach brief (optional)
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={{
                    fontSize: 11,
                  }}
                />
              </label>

              <button
                onClick={generate}
                disabled={loading || (!prompt && !file)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 999,
                  border: "none",
                  backgroundColor:
                    loading || (!prompt && !file) ? "#CBD5F5" : "#1D4ED8",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor:
                    loading || (!prompt && !file) ? "not-allowed" : "pointer",
                  boxShadow:
                    loading || (!prompt && !file)
                      ? "none"
                      : "0 12px 30px rgba(37, 99, 235, 0.35)",
                  whiteSpace: "nowrap",
                }}
              >
                {loading ? "Generating plan..." : "Generate plan"}
              </button>
            </div>

            <p
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "#9CA3AF",
              }}
            >
              Press <strong>Ctrl + Enter</strong> to generate using just the
              text brief.
            </p>
          </section>

          {/* Right column: Output preview */}
          <section
            aria-label="Generated project plan"
            style={{
              flex: "1 1 360px",
              minWidth: 0,
              borderRadius: 12,
              border: "1px solid #E2E8F0",
              padding: 16,
              boxSizing: "border-box",
              backgroundColor: "#0B1120",
              color: "#E5E7EB",
              display: "flex",
              flexDirection: "column",
              maxHeight: 520,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
                gap: 8,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 14,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#9CA3AF",
                  }}
                >
                  Output
                </h2>
                <p
                  style={{
                    margin: 4,
                    marginLeft: 0,
                    fontSize: 12,
                    color: "#6B7280",
                  }}
                >
                  Your structured project plan will appear here after
                  generation.
                </p>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                borderRadius: 10,
                background:
                  "radial-gradient(circle at top left, rgba(37,99,235,0.16) 0, rgba(15,23,42,1) 45%, rgba(15,23,42,1) 100%)",
                padding: 14,
                boxSizing: "border-box",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {output ? (
                output
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#E5E7EB",
                      fontWeight: 500,
                    }}
                  >
                    Ready when you are.
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: "#9CA3AF",
                    }}
                  >
                    Generate a plan to see phases, milestones, risks, and
                    resource assumptions tailored to your project.
                  </p>
                </div>
              )}
            </div>

            {loading && (
              <p
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "#9CA3AF",
                }}
              >
                Drafting project structure, milestones, and
                assumptions&hellip;
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
