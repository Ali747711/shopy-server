const ts = () => new Date().toISOString();

export const logger = {
  info: (msg: string, meta?: unknown) =>
    console.log(`[INFO]  ${ts()} ${msg}`, meta ?? ""),
  warn: (msg: string, meta?: unknown) =>
    console.warn(`[WARN]  ${ts()} ${msg}`, meta ?? ""),
  error: (msg: string, meta?: unknown) =>
    console.error(`[ERROR] ${ts()} ${msg}`, meta ?? ""),
};
