import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db"; // Server-only
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/session"; // Edge-compatible utils

export async function login(pin: string) {
    // 1. Find user by PIN (In production, find by ID then compare Hash)
    // Since we don't have a keypad for ID, we assume distinct PINs for MVP or a list to pick from.
    // For this MVP, we will query by pin_hash (assuming unique PINs for simplicity)
    const user = await db.query.users.findFirst({
        where: eq(users.pin_hash, pin),
    });

    if (!user) return null;

    // 2. Create Session
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const session = await encrypt({ user, expires });

    // 3. Set Cookie
    (await cookies()).set("session", session, { expires, httpOnly: true });

    return user;
}

export async function logout() {
    (await cookies()).set("session", "", { expires: new Date(0) });
}

export async function getSession() {
    const session = (await cookies()).get("session")?.value;
    if (!session) return null;
    return await decrypt(session);
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
