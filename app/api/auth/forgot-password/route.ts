import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function ok() {
  // Always return success to avoid account enumeration.
  return NextResponse.json({ success: true, message: "If an account exists for that email, a reset link has been sent." });
}

function baseUrl() {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = body?.email;
    const email =
      typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
    if (!email) return ok();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) return ok();

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Invalidate older unused tokens for this user (optional hygiene).
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const url = `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = "Reset your ProjectWorks.ai password";
    const text = `Use the link below to reset your password (valid for 1 hour):\n\n${url}\n\nIf you didn't request this, you can ignore this email.`;
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2 style="margin: 0 0 8px 0;">Reset your password</h2>
        <p style="margin: 0 0 16px 0;">Click the button below to set a new password. This link expires in 1 hour.</p>
        <p style="margin: 0 0 16px 0;">
          <a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600;">
            Reset password
          </a>
        </p>
        <p style="margin: 0; font-size: 12px; color: #64748b;">
          If you didn’t request this, you can ignore this email.
        </p>
      </div>
    `;

    await sendEmail({ to: user.email, subject, text, html });
    return ok();
  } catch (e) {
    console.error("Forgot password error:", e);
    // Still return generic success to avoid leaking, but log server-side.
    return ok();
  }
}

