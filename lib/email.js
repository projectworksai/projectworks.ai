import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendResetEmail(to, resetLink) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject: "Reset your password",
      html: `
        <h2>Reset your password</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 30 minutes.</p>
      `,
    });
  } catch (err) {
    console.error("Email error:", err);
    throw err;
  }
}