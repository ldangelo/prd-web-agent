/**
 * Next.js instrumentation hook.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * The `register()` function is called once when the Next.js server starts.
 * We only initialise OpenTelemetry on the server side (Node.js runtime).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initTelemetry } = await import("@/lib/telemetry/instrumentation");
    initTelemetry();
  }
}
