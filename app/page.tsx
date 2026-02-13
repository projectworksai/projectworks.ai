"use client";

import { useState } from "react";
import {
  getMainSectionsOnly,
  toSummary,
  getIndexContentForTable,
  parseIndexLine,
} from "@/lib/parser";

export default function Home() {
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  async function generate() {
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

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Generation failed");
      }
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function downloadWord() {
    if (!data) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: data, format: "docx" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project-plan.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const mainSections = data ? getMainSectionsOnly(data) : {};
  const hasSections = Object.keys(mainSections).length > 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        background: "#fff",
        color: "#1a1a1a",
      }}
    >
      <header style={{ marginBottom: 28, textAlign: "center" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          Plan Forge
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "6px 0 0 0" }}>
          Turn tenders and specs into world-class project plans.
        </p>
      </header>

      {/* Project profile */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 4 }}>Project name</label>
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
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontFamily: "inherit",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 4 }}>Client</label>
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
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontFamily: "inherit",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 4 }}>Location</label>
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
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left: inputs */}
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 24,
            background: "#fafafa",
          }}
        >
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#111", margin: "0 0 4px 0" }}>
            Inputs
          </h2>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 20px 0" }}>
            Provide your brief and client documents. We use them to build a comprehensive, standards-aligned plan.
          </p>

          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
            Project brief
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Paste or type your project brief..."
            rows={5}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 12,
              fontSize: 14,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              resize: "vertical",
              marginBottom: 16,
              fontFamily: "inherit",
            }}
          />

          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
            Tender document (client)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setTenderFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 13 }}
            />
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {tenderFile ? tenderFile.name : "—"}
            </span>
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
            Technical specification (client)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setTechnicalSpecFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 13 }}
            />
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {technicalSpecFile ? technicalSpecFile.name : "—"}
            </span>
          </div>

          <button
            onClick={generate}
            disabled={loading}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              background: "#111",
              border: "none",
              borderRadius: 6,
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

        {/* Right: generated plan */}
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 24,
            background: "#fff",
            minHeight: 320,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#111", margin: "0 0 6px 0" }}>
            Output
          </h2>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px 0" }}>
            Project summary or outline. Download for full detail.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#374151" }}>
              {loading ? "Generating…" : hasSections ? "Ready" : ""}
            </span>
            {hasSections && (
              <button
                onClick={downloadWord}
                disabled={downloading}
                style={{
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#fff",
                  background: "#111",
                  border: "none",
                  borderRadius: 6,
                  cursor: downloading ? "wait" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {downloading ? "Preparing…" : "Download for full detail"}
              </button>
            )}
          </div>

          <div
            style={{
              flex: 1,
              overflow: "auto",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {!hasSections && !loading && (
              <div style={{ color: "#9ca3af", fontSize: 13 }}>—</div>
            )}
            {hasSections &&
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
                return (
                  <div key={title} style={{ marginBottom: 8, borderBottom: "1px solid #f3f4f6", paddingBottom: 12 }}>
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
                        color: "#374151",
                        textAlign: "left",
                      }}
                    >
                      <span>{title}</span>
                      <span style={{ fontSize: 18, color: "#6b7280" }}>{isExpanded ? "−" : "+"}</span>
                    </button>
                    {isExpanded && (
                      <div style={{ paddingTop: 4 }}>
                        {hasIndexTable ? (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#374151", width: 40 }}>No.</th>
                                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#374151" }}>Section</th>
                                <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#374151", width: 56 }}>Page</th>
                              </tr>
                            </thead>
                            <tbody>
                              {indexRows.map((line, i) => {
                                const { num, section, page } = parseIndexLine(line, i);
                                return (
                                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                    <td style={{ padding: "8px 10px", color: "#6b7280" }}>{num}</td>
                                    <td style={{ padding: "8px 10px", color: "#1a1a1a" }}>{section}</td>
                                    <td style={{ padding: "8px 10px", color: "#6b7280", textAlign: "right" }}>{page}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ whiteSpace: "pre-wrap", color: "#1a1a1a", fontSize: 13 }}>
                            {isIndex ? (indexContent || "—") : toSummary(text)}
                          </div>
                        )}
                      </div>
                    )}
                    {!isExpanded && (
                      <div style={{ fontSize: 12, color: "#6b7280", paddingLeft: 0, lineHeight: 1.4 }}>{summary}</div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      </div>
    </main>
  );
}
