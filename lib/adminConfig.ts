// Admin credentials stored in MongoDB so they can be changed from the Admin
// settings page. Seeded from the original hard-coded defaults on first use so
// the owner is never locked out.

import clientPromise from "./mongodb";
import bcrypt from "bcryptjs";
import type { Collection } from "mongodb";

const ADMIN_DOC_ID = "admin";

// The initial admin credentials are NO LONGER stored in the source code.
// They are read once from environment variables (set on the server, never in
// git) and then seeded — hashed — into MongoDB. After the first run the values
// live only in the database (as a bcrypt hash) and can be changed from the
// Admin settings page. If these env vars are absent and nothing is seeded yet,
// password admin login is simply disabled and you sign in via Google recovery.
//   ADMIN_LOGIN     — the admin username or email
//   ADMIN_PASSWORD  — the initial admin password

interface AdminDoc {
  _id: string;
  loginName: string;
  passwordHash: string;
  updatedAt?: Date;
}

export interface AdminConfig {
  loginName: string;
  passwordHash: string;
}

async function adminCol(): Promise<Collection<AdminDoc>> {
  const client = await clientPromise;
  return client.db().collection<AdminDoc>("admin_config");
}

/**
 * Read the admin config. If none is stored yet, seed it from the ADMIN_LOGIN /
 * ADMIN_PASSWORD environment variables (hashed). If those env vars are missing,
 * returns an empty config, which disables password admin login (Google recovery
 * still works) instead of falling back to any credential baked into the code.
 */
export async function getAdminConfig(): Promise<AdminConfig> {
  const col = await adminCol();
  const doc = await col.findOne({ _id: ADMIN_DOC_ID });
  if (doc?.loginName && doc?.passwordHash) {
    return { loginName: doc.loginName, passwordHash: doc.passwordHash };
  }

  const envLogin = process.env.ADMIN_LOGIN?.trim();
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envLogin && envPassword) {
    const passwordHash = await bcrypt.hash(envPassword, 10);
    await col.updateOne(
      { _id: ADMIN_DOC_ID },
      { $set: { loginName: envLogin, passwordHash, updatedAt: new Date() } },
      { upsert: true }
    );
    return { loginName: envLogin, passwordHash };
  }

  // Nothing configured yet — password admin login is disabled on purpose.
  return { loginName: "", passwordHash: "" };
}

/** Update the admin login name and/or password (password is re-hashed). */
export async function updateAdminConfig(update: {
  loginName?: string;
  newPassword?: string;
}): Promise<void> {
  const col = await adminCol();
  const set: Partial<AdminDoc> = { updatedAt: new Date() };
  if (update.loginName) set.loginName = update.loginName.trim();
  if (update.newPassword) set.passwordHash = await bcrypt.hash(update.newPassword, 10);
  await col.updateOne({ _id: ADMIN_DOC_ID }, { $set: set }, { upsert: true });
}
