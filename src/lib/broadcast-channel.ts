const CHANNEL_NAME = "consignacion-app";

export type BroadcastMessage =
  | { type: "sucursal-changed"; sucursalId: number }
  | { type: "plan-changed" }
  | { type: "session-revoked" };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!("BroadcastChannel" in window)) return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export function postAppMessage(message: BroadcastMessage): void {
  const ch = getChannel();
  if (ch) {
    ch.postMessage(message);
    return;
  }
  // Fallback: storage event para browsers sin BroadcastChannel
  if (typeof window !== "undefined") {
    const key = `__broadcast_${CHANNEL_NAME}`;
    localStorage.setItem(key, JSON.stringify({ ...message, _ts: Date.now() }));
    // Limpiar inmediatamente para permitir mensajes repetidos con mismo payload
    setTimeout(() => localStorage.removeItem(key), 100);
  }
}

export function subscribeAppMessages(
  callback: (message: BroadcastMessage) => void
): () => void {
  // BroadcastChannel listener
  const ch = getChannel();
  if (ch) {
    const handler = (event: MessageEvent<BroadcastMessage>) => {
      callback(event.data);
    };
    ch.addEventListener("message", handler);
    return () => ch.removeEventListener("message", handler);
  }

  // Fallback: storage event
  if (typeof window === "undefined") return () => {};
  const key = `__broadcast_${CHANNEL_NAME}`;
  const handler = (event: StorageEvent) => {
    if (event.key !== key || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue);
      const { _ts: _, ...message } = parsed;
      callback(message as BroadcastMessage);
    } catch { /* ignore malformed */ }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
