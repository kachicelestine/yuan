type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const format = process.env.LOG_FORMAT ?? (process.env.NODE_ENV === "production" ? "json" : "pretty");

/** Errors keep their message and stack when logged as fields. */
function plain(fields: Fields) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v instanceof Error ? { message: v.message, stack: v.stack } : v]));
}

function write(level: Level, msg: string, fields: Fields = {}) {
  const line =
    format === "json"
      ? JSON.stringify({ time: new Date().toISOString(), level, msg, ...plain(fields) })
      : `${level === "info" ? "" : `[${level}] `}${msg}${Object.keys(fields).length ? ` ${JSON.stringify(plain(fields))}` : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * One structured line per event: JSON in production (for Grafana/Loki or any log shipper),
 * readable text in development. Use `scope` to tag a subsystem, e.g. log.child({ scope: "jobs" }).
 */
export const log = {
  debug: (msg: string, fields?: Fields) => process.env.LOG_DEBUG && write("debug", msg, fields),
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
  child: (base: Fields) => ({
    info: (msg: string, fields?: Fields) => write("info", msg, { ...base, ...fields }),
    warn: (msg: string, fields?: Fields) => write("warn", msg, { ...base, ...fields }),
    error: (msg: string, fields?: Fields) => write("error", msg, { ...base, ...fields }),
  }),
};
