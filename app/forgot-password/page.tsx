export default function ForgotPasswordPage() {
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
          Password reset emails aren’t enabled yet. If you can’t access your account, email the Project Works Team and
          we’ll help you regain access.
        </p>

        <div style={{ marginTop: 16, padding: 14, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#0f172a" }}>
            Email:{" "}
            <a href="mailto:thesmartaustralia@gmail.com" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
              thesmartaustralia@gmail.com
            </a>
          </p>
          <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#64748b" }}>
            Include your sign-in email address and we’ll respond as soon as possible.
          </p>
        </div>

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

