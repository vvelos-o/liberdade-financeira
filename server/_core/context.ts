/**
 * tRPC context — PIN-based auth (independent from Manus OAuth).
 * Reads the session cookie, verifies the JWT with JWT_SECRET,
 * and returns a synthetic "owner" user if valid.
 */
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";
import { ENV } from "./env";

// Synthetic owner user — the app is single-user (personal finance tool).
const OWNER_USER = {
  id: 1,
  openId: "owner",
  name: "Dono",
  email: null as string | null,
  loginMethod: "pin" as string | null,
  role: "admin" as const,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastSignedIn: new Date(),
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: typeof OWNER_USER | null;
};

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) map.set(k.trim(), decodeURIComponent(v.join("=")));
  }
  return map;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: typeof OWNER_USER | null = null;
  try {
    const cookies = parseCookies(opts.req.headers.cookie);
    const token = cookies.get(COOKIE_NAME);
    if (token) {
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      if (payload.sub === "owner") {
        user = { ...OWNER_USER, lastSignedIn: new Date() };
      }
    }
  } catch {
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}
