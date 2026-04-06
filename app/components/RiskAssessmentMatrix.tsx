"use client";

import {
  LIKELIHOOD_AXIS_LABELS,
  SEVERITY_AXIS_LABELS,
  RISK_ASSESSMENT_BANDS,
  riskBandCellStyle,
  buildRiskCountGrid,
} from "@/lib/risk-matrix";

type Props = {
  /** If provided, show counts in cells; otherwise band label only. */
  register?: Array<{ likelihood?: unknown; severity?: unknown }>;
};

export function RiskAssessmentMatrix({ register }: Props) {
  const counts = register?.length ? buildRiskCountGrid(register) : null;

  return (
    <div style={{ marginTop: 4, marginBottom: 12 }}>
      <p style={{ margin: "0 0 10px 0", fontWeight: 700, fontSize: 13, textAlign: "center", color: "#0f172a" }}>
        Risk assessment matrix
      </p>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 420,
            borderCollapse: "collapse",
            fontSize: 11,
            boxShadow: "0 1px 3px rgba(15,23,42,0.08)",
            border: "1px solid #cbd5e1",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  padding: "8px 6px",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  width: 112,
                }}
              />
              <th
                colSpan={5}
                style={{
                  padding: "6px 6px 8px 6px",
                  border: "1px solid #cbd5e1",
                  background: "#e2e8f0",
                  color: "#334155",
                  fontWeight: 700,
                  textAlign: "center",
                  fontSize: 11,
                  letterSpacing: "0.02em",
                }}
              >
                Severity →
              </th>
            </tr>
            <tr>
              <th
                style={{
                  textAlign: "center",
                  padding: "8px 6px",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  color: "#475569",
                  fontWeight: 600,
                  verticalAlign: "middle",
                  fontSize: 10,
                  lineHeight: 1.2,
                }}
              >
                Likelihood
                <br />
                <span style={{ fontWeight: 500, color: "#64748b" }}>↓</span>
              </th>
              {SEVERITY_AXIS_LABELS.map((lab) => (
                <th
                  key={lab}
                  style={{
                    padding: "8px 6px",
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    color: "#334155",
                    fontWeight: 600,
                    textAlign: "center",
                    lineHeight: 1.25,
                  }}
                >
                  {lab}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LIKELIHOOD_AXIS_LABELS.map((likLab, rowIdx) => (
              <tr key={likLab}>
                <th
                  style={{
                    textAlign: "right",
                    padding: "8px 10px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {likLab}
                </th>
                {SEVERITY_AXIS_LABELS.map((_, colIdx) => {
                  const band = RISK_ASSESSMENT_BANDS[rowIdx][colIdx];
                  const { background, color } = riskBandCellStyle(band);
                  const n = counts ? counts[rowIdx][colIdx] : 0;
                  return (
                    <td
                      key={colIdx}
                      style={{
                        padding: "10px 8px",
                        border: "1px solid #94a3b8",
                        background,
                        color,
                        textAlign: "center",
                        fontWeight: 700,
                        lineHeight: 1.35,
                        verticalAlign: "middle",
                      }}
                    >
                      <span style={{ display: "block", fontSize: 11 }}>{band}</span>
                      {counts !== null && n > 0 && (
                        <span
                          style={{
                            display: "block",
                            marginTop: 4,
                            fontSize: 14,
                            fontWeight: 800,
                            textShadow: color === "#ffffff" ? "0 0 1px rgba(0,0,0,0.35)" : undefined,
                          }}
                        >
                          {n}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 10,
          fontSize: 11,
          color: "#64748b",
        }}
      >
        <span>Risk matrix (likelihood × severity bands)</span>
        <span style={{ fontWeight: 600, color: "#475569" }}>Likelihood × Severity = Risk level</span>
      </div>
    </div>
  );
}
