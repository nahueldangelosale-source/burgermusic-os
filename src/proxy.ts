import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

const JwtPayloadSchema = z.object({
  role: z.enum(["C_LEVEL", "STORE_MANAGER", "KITCHEN", "RECEIVER"]),
  storeId: z.string().optional(),
});

// Mock Edge-First JWT Decryption
function decodeSession(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  try {
    const decodedStr = Buffer.from(token, "base64").toString("utf-8");
    return JwtPayloadSchema.parse(JSON.parse(decodedStr));
  } catch {
    return null;
  }
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Enrutamiento Zero-Trust C-Level Holding
  const holdingRoutes = [
    "/command-center",
    "/treasury",
    "/expansion",
    "/procurement",
    "/suppliers",
  ];
  if (holdingRoutes.some((route) => pathname.startsWith(route))) {
    const session = decodeSession(req);

    // Regla Inquebrantable
    if (!session || session.role !== "C_LEVEL") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  // 2. Enrutamiento Operativo Store
  const storeRoutes = ["/operations", "/inventory"];
  if (storeRoutes.some((route) => pathname.startsWith(route))) {
    const session = decodeSession(req);
    if (!session || !["C_LEVEL", "STORE_MANAGER"].includes(session.role)) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|unauthorized).*)"],
};
