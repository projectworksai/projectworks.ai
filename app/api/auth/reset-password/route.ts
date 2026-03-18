import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, code, message }, { status });
}

function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 10) issues.push("at least 10 characters");
  if (!/[a-z]/.test(password)) issues.push("one lowercase letter");
  if (!/[A-Z]/.test(password)) issues.push("one uppercase letter");
  if (!/[0-9]/.test(password)) issues.push("one number");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("one symbol");
  return issues;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tokenRaw = body?.token;
    const newPasswordRaw = body?.newPassword;

    const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
    const newPassword =
      typeof newPasswordRaw === "string" ? newPasswordRaw : "";

    if (!token) {
      return errorResponse("MISSING_TOKEN", "Reset token is required.", 400);
    }
    const issues = passwordIssues(newPassword);
    if (issues.length) {
      return errorResponse(
        "WEAK_PASSWORD",
        `Password must include ${issues.join(", ")}.`,
        400
      );
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const reset = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!reset || reset.usedAt) {
      return errorResponse("INVALID_TOKEN", "This reset link is invalid or has already been used.", 400);
    }
    if (reset.expiresAt.getTime() < Date.now()) {
      return errorResponse("EXPIRED_TOKEN", "This reset link has expired. Please request a new one.", 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Reset password error:", e);
    return errorResponse("RESET_FAILED", "Could not reset password. Please try again.", 500);
  }
}

