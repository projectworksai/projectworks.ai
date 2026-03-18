import nodemailer from "nodemailer";

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  const port = portRaw ? Number(portRaw) : NaN;
  if (!host || !Number.isFinite(port) || !user || !pass || !from) return null;

  return { host, port, user, pass, from };
}

export async function sendEmail(args: SendEmailArgs) {
  const cfg = getSmtpConfig();
  if (!cfg) {
    throw new Error("Email service is not configured (set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).");
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  await transporter.sendMail({
    from: cfg.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  });
}

export async function sendResetEmail(to: string, resetLink: string) {
  // Keep this aligned with the reset-token expiry used in the reset-password route (30 mins).
  const subject = "Reset your password";
  const text = `Click the link below to reset your password:\n\n${resetLink}\n\nThis link will expire in 30 minutes.`;
  const html = `
    <h2>Reset your password</h2>
    <p>Click the link below to reset your password:</p>
    <a href="${resetLink}">${resetLink}</a>
    <p>This link will expire in 30 minutes.</p>
  `;

  await sendEmail({ to, subject, text, html });
}

