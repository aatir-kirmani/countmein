/** Fire-and-forget email notification for a join request state change. */
export function notify(requestId: string | null | undefined) {
  if (!requestId) return;
  fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId }) }).catch(() => {});
}
