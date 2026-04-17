const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  info:  (m: string, d?: unknown) => console.log(`[INFO] ${m}`, d ?? ""),
  warn:  (m: string, d?: unknown) => console.warn(`[WARN] ${m}`, d ?? ""),
  error: (m: string, e?: unknown) => console.error(`[ERROR] ${m}`, e ?? ""),
  debug: (m: string, d?: unknown) => { if (isDev) console.debug(`[DEBUG] ${m}`, d ?? ""); },
};
