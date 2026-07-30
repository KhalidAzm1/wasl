/**
 * GET /api/events  — Server-Sent Events stream.
 *
 * Clients connect once and receive push notifications when server-side data
 * changes.  No sensitive payload is sent — the frontend uses each event
 * purely as a signal to invalidate its React-Query cache and refetch.
 *
 * The endpoint is intentionally public so that the quick-update QR form
 * (no auth token) could also use it in the future.  Events carry only a
 * resource-type label; no PII or auth tokens are emitted.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { eventBus } from "../lib/event-bus";

const router: IRouter = Router();

router.get("/events", (req: Request, res: Response) => {
  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering
  res.flushHeaders();

  // Helper: write a named SSE event
  function send(event: string, data: unknown) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Heartbeat every 25 s to keep proxy connections alive
  const heartbeat = setInterval(() => res.write(":heartbeat\n\n"), 25_000);

  // ── Listeners ──────────────────────────────────────────────────────────────
  const onBankUpdated = (payload: { bankId: string }) =>
    send("bank_updated", payload);

  const onMeetingUpdated = (payload: { bankId?: string }) =>
    send("meeting_updated", payload);

  const onDashboardChanged = () => send("dashboard_changed", {});

  eventBus.on("bank_updated",      onBankUpdated);
  eventBus.on("meeting_updated",   onMeetingUpdated);
  eventBus.on("dashboard_changed", onDashboardChanged);

  // ── Cleanup on disconnect ──────────────────────────────────────────────────
  req.on("close", () => {
    clearInterval(heartbeat);
    eventBus.off("bank_updated",      onBankUpdated);
    eventBus.off("meeting_updated",   onMeetingUpdated);
    eventBus.off("dashboard_changed", onDashboardChanged);
  });
});

export default router;
