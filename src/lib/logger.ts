import pino, {
  Logger,
  DestinationStream,
  LoggerOptions,
  multistream,
} from "pino";
import { trace, context } from "@opentelemetry/api";
import path from "path";

interface CreateLoggerOptions {
  destination?: DestinationStream;
}

const LOG_FILE_PATH =
  process.env.LOG_FILE_PATH ||
  path.join(process.cwd(), "logs", "app.log");

/**
 * Creates a pino logger that automatically injects OpenTelemetry trace context
 * (trace_id, span_id) into every log entry when a span is active.
 *
 * In development, writes to both stdout and a log file (logs/app.log).
 *
 * @param opts.destination - Optional writable stream (useful for testing).
 *   Defaults to stdout + file multistream.
 */
export function createLogger(opts?: CreateLoggerOptions): Logger {
  const level = process.env.LOG_LEVEL || "info";

  const pinoOpts: LoggerOptions = {
    level,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    mixin() {
      const span = trace.getSpan(context.active());
      if (span) {
        const spanContext = span.spanContext();
        return {
          trace_id: spanContext.traceId,
          span_id: spanContext.spanId,
        };
      }
      return {};
    },
  };

  if (opts?.destination) {
    return pino(pinoOpts, opts.destination);
  }

  const streams: pino.StreamEntry[] = [
    { stream: process.stdout },
    {
      stream: pino.destination({
        dest: LOG_FILE_PATH,
        mkdir: true,
        sync: false,
      }),
    },
  ];

  return pino(pinoOpts, multistream(streams));
}

/**
 * Default application logger instance.
 * Writes JSON to stdout and logs/app.log with automatic OTel trace context injection.
 */
const logger = createLogger();

export default logger;
