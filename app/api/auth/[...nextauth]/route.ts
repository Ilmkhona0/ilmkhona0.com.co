// app/api/auth/[...nextauth]/route.ts
// NextAuth v5 catch-all handler. Re-exports from auth.ts at project root.

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
