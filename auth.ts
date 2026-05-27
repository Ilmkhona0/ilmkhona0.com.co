// auth.ts  (project root)
//
// Auth.js v5 / NextAuth v5 configuration.
// - Google + GitHub social login
// - Credentials (email + password) that AUTO-REGISTERS on first use
// - Hard-coded admin (ilmkhona0 / MySecret123) preserved
// - JWT session strategy so the Credentials provider works with the DB adapter

import NextAuth, { type DefaultSession } from "next-auth";
import "next-auth/jwt";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import bcrypt from "bcryptjs";
import clientPromise from "./lib/mongodb";
import { getAdminConfig } from "./lib/adminConfig";

// Extend the session/user types so TS knows about isAdmin.
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      username?: string | null;
      isAdmin?: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    isAdmin?: boolean;
    username?: string | null;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    isAdmin?: boolean;
    username?: string | null;
    uid?: string;
  }
}
// Google login with this email is always trusted as admin (Google verifies the
// email), serving as a permanent recovery path even if the DB credentials are
// changed from the Admin settings page.
const RECOVERY_ADMIN_EMAIL = "ilmkhona@gmail.com";

// Helper: only enable an OAuth provider if both its client ID and secret are
// actually present in the environment. Empty/missing values make NextAuth v5
// throw a generic "Configuration" 500 from /api/auth/session, which silently
// kills login even for email+password. Conditional loading prevents that.
function hasEnv(...keys: string[]) {
  return keys.every((k) => {
    const v = process.env[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const oauthProviders: any[] = [];
if (hasEnv("AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET")) {
  oauthProviders.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
      // Always show Google's account picker instead of silently reusing the
      // last-used account. Lets users with multiple Google accounts choose
      // which one to sign in with (e.g. the admin account).
      authorization: { params: { prompt: "select_account" } },
    })
  );
}
if (hasEnv("AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET")) {
  oauthProviders.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/auth" },
  providers: [
    ...oauthProviders,
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        // Admin login — credentials live in the database and are editable from
        // the Admin settings page. The recovery email is also accepted so the
        // owner can never be locked out.
        const adminCfg = await getAdminConfig();
        const isAdminLogin =
          email === adminCfg.loginName.trim().toLowerCase() ||
          email === RECOVERY_ADMIN_EMAIL;
        if (isAdminLogin) {
          const ok = await bcrypt.compare(password, adminCfg.passwordHash);
          if (ok) {
            return {
              id: "admin",
              email: RECOVERY_ADMIN_EMAIL,
              name: adminCfg.loginName,
              username: adminCfg.loginName,
              isAdmin: true,
            };
          }
          // Wrong admin password — do NOT fall through to auto-registration,
          // which previously could mint an admin account for this email.
          throw new Error("Incorrect admin password.");
        }

        const client = await clientPromise;
        const db = client.db();

        // Block list check
        const blocked = await db.collection("blocked").findOne({
          $or: [{ email }, { username: email }],
        });
        if (blocked) {
          throw new Error("This account has been blocked.");
        }

        const users = db.collection("users");
        const existing = await users.findOne({ email });

        if (existing) {
          // Existing account → verify password.
          const stored: string = existing.password || "";
          let ok = false;
          if (stored.startsWith("$2")) {
            ok = await bcrypt.compare(password, stored);
          } else {
            // legacy plaintext (from the old register route) — one-time upgrade
            ok = stored === password;
            if (ok) {
              const hashed = await bcrypt.hash(password, 10);
              await users.updateOne({ _id: existing._id }, { $set: { password: hashed } });
            }
          }
          if (!ok) return null;
          return {
            id: String(existing._id),
            email: existing.email,
            name: existing.name || existing.username || existing.email,
            username: existing.username || existing.email,
            isAdmin: false,
          };
        }

        // No matching account. New email accounts are created ONLY through the
        // verified Sign up flow (email code) or via Google/GitHub — never
        // auto-created from a login attempt. So an unknown email is rejected.
        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Block list also applies to social sign-in
      if (user?.email) {
        const client = await clientPromise;
        const db = client.db();
        const blocked = await db.collection("blocked").findOne({
          $or: [{ email: user.email }, { username: user.email }],
        });
        if (blocked) return false;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.uid = user.id;
        token.isAdmin = !!user.isAdmin;
        token.username =
          (user as { username?: string }).username || user.name || user.email;
      }
      // Google login with the recovery admin email is trusted (Google verifies
      // ownership). We intentionally do NOT grant admin by email on the
      // credentials path — that would let anyone claim the email.
      if (
        account?.provider === "google" &&
        token.email &&
        String(token.email).toLowerCase() === RECOVERY_ADMIN_EMAIL
      ) {
        token.isAdmin = true;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.uid) session.user.id = token.uid;
        session.user.isAdmin = !!token.isAdmin;
        session.user.username = token.username ?? null;
      }
      return session;
    },
  },
});
