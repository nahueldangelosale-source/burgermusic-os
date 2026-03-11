import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

const PROTECTED_ROUTES = ["/dashboard", "/lab", "/ingest", "/receive"];
const PUBLIC_ROUTES = ["/login", "/sign-in"]; // "sign-in" kept for legacy, moved to "login"

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;
    const isProtectedRoute = PROTECTED_ROUTES.some((route) => path.startsWith(route));

    // 1. Check for Session Cookie
    const cookie = request.cookies.get("session")?.value;
    let session = null;

    if (cookie) {
        try {
            session = await decrypt(cookie);
        } catch (e) {
            // Invalid session -> Treat as logged out
        }
    }

    // 2. Redirect Logic based on Logged In status
    if (isProtectedRoute && !session && path !== "/login") {
        return NextResponse.redirect(new URL("/login", request.nextUrl));
    }

    if (session && path === "/login") {
        // If logged in try to access login, redirect to their home
        if (session.user.role === "KITCHEN") return NextResponse.redirect(new URL("/ingest", request.nextUrl));
        if (session.user.role === "RECEIVER") return NextResponse.redirect(new URL("/receive", request.nextUrl)); // Will 404 if not exists, but follows spec
        return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
    }

    // 3. RBAC Enforcement (Strict Mode)
    if (session) {
        const role = session.user.role;

        // KITCHEN: Only /ingest allowed (and /lab? check prompt. "Bloquear acceso a /dashboard")
        if (role === "KITCHEN") {
            if (path.startsWith("/dashboard") || path.startsWith("/lab")) {
                return NextResponse.redirect(new URL("/ingest", request.nextUrl));
            }
        }

        // RECEIVER: Only /receive allowed?
        if (role === "RECEIVER") {
            if (!path.startsWith("/receive")) {
                // Maybe allow ingest too? Prompt said "Redirigir forzosamente a /receive" if role is RECEIVER.
                // Implies strict lock.
                if (!path.startsWith("/receive")) {
                    return NextResponse.redirect(new URL("/receive", request.nextUrl));
                }
            }
        }

        // MANAGER: Full Access (implicit)
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
