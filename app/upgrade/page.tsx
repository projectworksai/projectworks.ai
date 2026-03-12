export default function UpgradePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: "#0f172a",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          maxWidth: 720,
          width: "100%",
          background: "#ffffff",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 20px 45px rgba(15,23,42,0.12)",
          border: "1px solid #e2e8f0",
        }}
      >
        <h1
          style={{
            fontSize: "1.75rem",
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.03em",
          }}
        >
          Upgrade to Plan Forge Pro
        </h1>
        <p style={{ margin: 0, marginBottom: 20, color: "#64748b", fontSize: 14 }}>
          Unlock full project plans, Word exports, and direct schedule downloads for Microsoft Project and Primavera.
          Online payments will be available shortly.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 20,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              padding: 20,
              background: "#f8fafc",
            }}
          >
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: 8 }}>What you get with Pro</h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
              <li>Full project plan including Quality, Risk, Safety, and Schedule sections.</li>
              <li>Downloadable Word document ready for client submission.</li>
              <li>Schedule export in CSV format for MS Project and Primavera.</li>
              <li>Higher limits for brief length and document size.</li>
            </ul>
          </div>

          <div
            style={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              padding: 20,
              background: "#0f172a",
              color: "#e5e7eb",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <p style={{ margin: 0, marginBottom: 8, fontSize: 13, color: "#cbd5f5" }}>
                Payments are not live yet.
              </p>
              <p style={{ margin: 0, fontSize: 13 }}>
                If you&apos;re interested in early access to Pro, please contact us and we&apos;ll set up your
                subscription manually.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a
                href="mailto:thesmartaustralia@gmail.com?subject=Plan%20Forge%20Pro%20enquiry"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "none",
                  background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 50%, #6366f1 100%)",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Email us about Pro
              </a>
              <a
                href="/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "9px 14px",
                  borderRadius: 999,
                  border: "1px solid #1f2937",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: 13,
                  fontWeight: 400,
                  textDecoration: "none",
                }}
              >
                Back to Plan Forge
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

