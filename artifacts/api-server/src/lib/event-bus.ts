/**
 * In-process event bus used to broadcast domain events to SSE clients.
 * Keeps a Set of active response writers; routes call emit() after mutations.
 */
import { EventEmitter } from "node:events";

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(500); // allow many SSE clients
