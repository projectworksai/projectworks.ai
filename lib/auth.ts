import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      plan: "FREE" | "PRO";
      subscriptionTier: "free" | "pro" | "team" | "enterprise";
      planGenerationsUsed: number;
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.passwordHash) return null;
        const match = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!match) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          subscriptionTier: user.subscriptionTier,
          planGenerationsUsed: user.planGenerationsUsed,
        } as {
          id: string;
          email: string;
          name: string | null;
          plan: "FREE" | "PRO";
          subscriptionTier: string;
          planGenerationsUsed: number;
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.plan = (user as { plan?: string }).plan || "FREE";
        token.subscriptionTier =
          (user as { subscriptionTier?: string }).subscriptionTier || "free";
        token.planGenerationsUsed =
          (user as { planGenerationsUsed?: number }).planGenerationsUsed ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            plan: true,
            subscriptionTier: true,
            planGenerationsUsed: true,
          },
        });
        session.user.plan = (dbUser?.plan as "FREE" | "PRO") || "FREE";
        session.user.subscriptionTier =
          (dbUser?.subscriptionTier as "free" | "pro" | "team" | "enterprise") ||
          "free";
        session.user.planGenerationsUsed = dbUser?.planGenerationsUsed ?? 0;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
