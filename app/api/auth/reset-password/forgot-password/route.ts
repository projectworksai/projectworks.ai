import { sendResetEmail } from "@/lib/email";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { email } = await req.json();

  const user = await prisma.user.findUnique({ where: { email } });

  // Optional: don't reveal if user exists
  if (!user) {
    return NextResponse.json({ success: true });
  }

  // Generate token
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Save token
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 mins
    },
  });

  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

  // ✅ SEND EMAIL HERE
  await sendResetEmail("karsem@gmail.com", "http://localhost:3000/reset?token=123");

  return NextResponse.json({ success: true });
}