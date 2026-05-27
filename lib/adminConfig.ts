// Admin credentials stored in MongoDB so they can be changed from the Admin
// settings page. Seeded from the original hard-coded defaults on first use so
// the owner is never locked out.

import clientPromise from "./mongodb";
import bcrypt from "bcryptjs";
import type { Collection } from "mongodb";

const ADMIN_DOC_ID = "admin";
const DEFAULT_LOGIN = "ilmkhona@gmail.com";
const DEFAULT_PASSWORD = "MySecret123";

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

/** Read the admin config, seeding the default credentials if none exist yet. */
export async function getAdminConfig(): Promise<AdminConfig> {
  const col = await adminCol();
  const doc = await col.findOne({ _id: ADMIN_DOC_ID });
  if (doc?.loginName && doc?.passwordHash) {
    return { loginName: doc.loginName, passwordHash: doc.passwordHash };
  }
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await col.updateOne(
    { _id: ADMIN_DOC_ID },
    { $set: { loginName: DEFAULT_LOGIN, passwordHash, updatedAt: new Date() } },
    { upsert: true }
  );
  return { loginName: DEFAULT_LOGIN, passwordHash };
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
