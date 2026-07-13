// Barrel file: all domain logic lives in server/db/ modules.
// This file re-exports everything so existing imports (`from "./db"`) keep working.
export * from "./db/index";
