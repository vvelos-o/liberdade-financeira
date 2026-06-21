/**
 * PIN-based authentication — replaces Manus OAuth.
 * The PIN is set via the APP_PIN environment variable on Railway.
 * A successful login issues a JWT session cookie valid for 1 year.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { SignJWT } from "jose";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";

function getSessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export function registerOAuthRoutes(app: Express) {
  // POST /api/auth/login  { pin: string }
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { pin } = req.body ?? {};
    if (!pin || pin !== ENV.appPin) {
      res.status(401).json({ error: "PIN incorreto" });
      return;
    }

    try {
      const issuedAt = Date.now();
      const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);
      const token = await new SignJWT({ sub: "owner", role: "admin" })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setExpirationTime(expirationSeconds)
        .sign(getSessionSecret());

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Erro interno ao criar sessão" });
    }
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });
}
