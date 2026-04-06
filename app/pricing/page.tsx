"use client";

export default function PricingPage() {
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
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "1.9rem",
              letterSpacing: "-0.04em",
            }}
          >
            Pricing for project teams
          </h1>
          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: 14,
              color: "#64748b",
            }}
          >
            <strong>Plan Forge V1</strong> includes full execution plans, Word export, and Microsoft Project XML
            schedules (for MS Project and Primavera P6 import) for everyone. The Pro, Team, and Enterprise rows below
            describe options we may offer in V2.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {/* Free */}
          <article
            style={{
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              padding: 20,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16 }}>Free (V1)</h2>
            <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#64748b" }}>
              Current release: full features at no charge.
            </p>
            <p style={{ margin: "14px 0 8px 0", fontSize: 22, fontWeight: 600 }}>$0</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
              <li>Full project plans (progressive and signed-in workflows)</li>
              <li>Word (.docx) export</li>
              <li>Schedule as Microsoft Project XML (opens in Project; import into Primavera P6)</li>
              <li>Risk matrix CSV export</li>
            </ul>
          </article>

          {/* Pro */}
          <article
            id="pro"
            style={{
              borderRadius: 16,
              border: "2px solid #1d4ed8",
              background: "#0f172a",
              padding: 20,
              color: "#e5e7eb",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 16,
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#22c55e",
                color: "#022c22",
                fontWeight: 600,
              }}
            >
              Most popular
          </div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Pro (V2 roadmap)</h2>
            <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#cbd5f5" }}>
              Planned for a future release—not required in V1.
            </p>
            <p style={{ margin: "14px 0 8px 0", fontSize: 22, fontWeight: 600 }}>$29/month</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#e5e7eb", lineHeight: 1.6 }}>
              <li>Unlimited project generation</li>
              <li>Full execution plans</li>
              <li>Save unlimited projects</li>
              <li>Export DOCX and PDF</li>
              <li>AI revision tools</li>
              <li>Procurement list &amp; compliance checklist</li>
            </ul>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/upgrade";
              }}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "9px 12px",
                borderRadius: 999,
                border: "none",
                background: "#e5f2ff",
                color: "#0f172a",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Talk to the Project Works Team
            </button>
          </article>

          {/* Team */}
          <article
            id="team"
            style={{
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              padding: 20,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16 }}>Team (V2 roadmap)</h2>
            <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#64748b" }}>
              Planned for a future release—not required in V1.
            </p>
            <p style={{ margin: "14px 0 8px 0", fontSize: 22, fontWeight: 600 }}>$99/month</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
              <li>Everything in Pro</li>
              <li>Up to 10 team members</li>
              <li>Shared projects &amp; version history</li>
              <li>Role permissions</li>
            </ul>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/upgrade";
              }}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "9px 12px",
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                background: "#0f172a",
                color: "#f9fafb",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Contact sales
            </button>
          </article>

          {/* Enterprise */}
          <article
            style={{
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              padding: 20,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16 }}>Enterprise</h2>
            <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#64748b" }}>
              For organisations needing custom models and compliance.
            </p>
            <p style={{ margin: "14px 0 8px 0", fontSize: 22, fontWeight: 600 }}>Custom</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
              <li>Unlimited team members</li>
              <li>Custom templates</li>
              <li>API access &amp; private AI models</li>
              <li>Advanced compliance modules</li>
              <li>Priority support</li>
            </ul>
            <a
              href="mailto:thesmartaustralia@gmail.com?subject=ProjectWorks%20Enterprise%20pricing"
              style={{
                display: "inline-flex",
                justifyContent: "center",
                alignItems: "center",
                marginTop: 16,
                width: "100%",
                padding: "9px 12px",
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#0f172a",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                fontFamily: "inherit",
              }}
            >
              Email Project Works Team
            </a>
          </article>
        </section>

        {/* Simple comparison table */}
        <section
          style={{
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            padding: 20,
            overflowX: "auto",
          }}
        >
          <h2 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Compare plans</h2>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}></th>
                <th style={{ textAlign: "center", padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>Free</th>
                <th style={{ textAlign: "center", padding: "8px 10px", borderBottom: "2px solid #1d4ed8" }}>Pro</th>
                <th style={{ textAlign: "center", padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>Team</th>
                <th style={{ textAlign: "center", padding: "8px 10px", borderBottom: "1px solid #e2e8f0" }}>
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Preview generations", "Unlimited", "Unlimited", "Unlimited", "Unlimited"],
                ["Full execution plans", "1 project", "Unlimited", "Unlimited", "Unlimited"],
                ["Save multiple projects", "No", "Yes", "Yes", "Yes"],
                ["Exports (DOCX / PDF)", "No", "Yes", "Yes", "Yes"],
                ["Team members", "1", "1", "Up to 10", "Unlimited"],
                ["API access / custom models", "No", "No", "Optional", "Yes"],
              ].map(([feature, free, pro, team, ent]) => (
                <tr key={feature}>
                  <td style={{ padding: "8px 10px", borderTop: "1px solid #f1f5f9", color: "#334155" }}>{feature}</td>
                  {[free, pro, team, ent].map((val, idx) => (
                    <td
                      key={idx}
                      style={{
                        padding: "8px 10px",
                        borderTop: "1px solid #f1f5f9",
                        textAlign: "center",
                        color: "#475569",
                      }}
                    >
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

