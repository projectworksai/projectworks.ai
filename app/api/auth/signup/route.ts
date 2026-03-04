import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, code, message, error: message },
    { status }
  );
}

function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
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
    const { email, password, name } = body || {};

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return errorResponse("INVALID_INPUT", "Email and password are required", 400);
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      return errorResponse("INVALID_EMAIL", "Please enter a valid email address", 400);
    }

    const issues = passwordIssues(password);
    if (issues.length) {
      return errorResponse(
        "WEAK_PASSWORD",
        `Password must include ${issues.join(", ")}`,
        400
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });
    if (existing) {
      return errorResponse(
        "EMAIL_EXISTS",
        "An account with this email already exists",
        409
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: trimmedEmail,
        passwordHash,
        name: typeof name === "string" ? name.trim() || null : null,
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
    });
  } catch (e) {
    console.error("Signup error:", e);
    return errorResponse(
      "SIGNUP_FAILED",
      "We couldn't create your account. Please try again in a moment.",
      500
    );
  }
}
