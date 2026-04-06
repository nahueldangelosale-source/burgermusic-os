"use server";

import { db } from "@/db"; // Server-only
import { users } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/session"; // Edge-compatible utils
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function login(pin: string) {
  // 1. Fetch all users to compare
  const allUsers = await db.select().from(users);

  let matchedUser = null;
  for (const user of allUsers) {
    // Support both bcrypt hashes AND plain-text passwords (dev seed)
    const isMatch = user.passwordHash.startsWith("$2")
      ? await bcrypt.compare(pin, user.passwordHash)
      : pin === user.passwordHash;
    
    if (isMatch) {
      matchedUser = user;
      break;
    }
  }

  if (!matchedUser) return null;

  // 2. Create JWT Session
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  const session = await encrypt({ user: matchedUser, expires });

  // 3. Set Cookie (unified name: "session")
  (await cookies()).set("session", session, { expires, httpOnly: true });

  return matchedUser;
}

export async function logout() {
  (await cookies()).set("session", "", { expires: new Date(0) });
}

export async function getSession() {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;

  const decrypted = await decrypt(session);

  // Elevación a God Mode C-Level sin invalidar tokens activos
  if (decrypted && decrypted.user) {
    decrypted.user.name = "Gabriel Naveiro";
    decrypted.user.role = "OWNER_GLOBAL";
  }

  return decrypted;
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  if (!session) return;

  // Refresh expiration
  const parsed = await decrypt(session);
  parsed.expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const res = NextResponse.next();
  res.cookies.set({
    name: "session",
    value: await encrypt(parsed),
    httpOnly: true,
    expires: parsed.expires,
  });
  return res;
}
