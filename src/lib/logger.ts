const __DEV__ = process.env.NODE_ENV !== "production";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

function sanitize(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  const sanitized: LogContext = {};
  const sensitiveKeys = ["password", "token", "secret", "key", "email", "phone", "ssn", "credit"];
  for (const [k, v] of Object.entries(context)) {
    const lower = k.toLowerCase();
    if (sensitiveKeys.some((s) => lower.includes(s))) {
      sanitized[k] = "[REDACTED]";
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const safeContext = sanitize(context);

  if (__DEV__) {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`[${level.toUpperCase()}] ${message}`, safeContext ?? "");
    return;
  }

  // Production: send to Sentry/Crashlytics when configured
  // For now, only log errors in production (no-op for debug/info)
  if (level === "error" || level === "warn") {
    // TODO: Integrate with Sentry.captureMessage or Crashlytics.log
    // Sentry.captureMessage(message, { level, extra: safeContext });
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};

export default logger;
