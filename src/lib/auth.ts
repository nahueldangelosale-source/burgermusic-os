import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db"; // Server-only
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/session"; // Edge-compatible utils
import bcrypt from "bcryptjs";

export async function login(pin: string) {
    // 1. Fetch all users to compare hash (In prod, find by ID/User then compare)
    // Since this is a PIN-only login for speed, we iterate.
    const allUsers = await db.select().from(users);
    
    let matchedUser = null;
    for (const user of allUsers) {
        if (await bcrypt.compare(pin, user.pin_hash)) {
            matchedUser = user;
            break;
        }
    }

    if (!matchedUser) return null;

    // 2. Create Session
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const session = await encrypt({ user: matchedUser, expires });

    // 3. Set Cookie
    (await cookies()).set("session", session, { expires, httpOnly: true });

    return matchedUser;
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
