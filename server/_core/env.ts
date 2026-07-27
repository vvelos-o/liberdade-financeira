export const ENV = {
  appPin: process.env.APP_PIN ?? "123456",
  cookieSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // LLM: prefer BUILT_IN_FORGE (Manus), fallback to OPENAI_API_KEY (Railway)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || process.env.OPENAI_API_URL || "https://api.openai.com",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || "",
};
