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
          maxWidth: 560,
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
          Plan Forge V1
        </h1>
        <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: 14, lineHeight: 1.55 }}>
          This release includes full project plans, Word export, and Microsoft Project XML schedule files for Microsoft
          Project and Primavera P6 (import as Microsoft Project XML) for everyone—no upgrade required.
        </p>
        <p style={{ margin: "0 0 24px 0", color: "#64748b", fontSize: 14, lineHeight: 1.55 }}>
          Optional paid plans and team features are planned for a future V2. Questions? Reach the team at{" "}
          <a href="mailto:thesmartaustralia@gmail.com" style={{ color: "#0284c7" }}>
            thesmartaustralia@gmail.com
          </a>
          .
        </p>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 18px",
            borderRadius: 999,
            border: "none",
            background: "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
            color: "#f9fafb",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Back to Plan Forge
        </a>
      </section>
    </main>
  );
}
