/** Arbiter endpoint selector: VM (prod) vs local (video/smooth testing).
 *
 * The toggle lives in Profile and persists to localStorage. The browser reads
 * it for everything it decides directly: the zero-leak canvas WebSocket and
 * artifact download URLs (hub-issued signed URLs rewritten to localhost).
 * Agent uploads are NOT affected — the hub hands the MCP its uploadUrl from
 * the worker env (ARBITER_PUBLIC_URL).
 */

export const VM_ARBITER_HTTP = "https://aegis-arbiter.ayiba.dev";
export const VM_ARBITER_WS = "wss://aegis-arbiter.ayiba.dev/screencast";
export const LOCAL_ARBITER_HTTP = "http://localhost:7144";
export const LOCAL_ARBITER_WS = "ws://localhost:7144/screencast";

const KEY = "aegis:useLocalArbiter";
export const ARBITER_CHANGED_EVENT = "aegis:arbiter-changed";

export function useLocalArbiter(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setUseLocalArbiter(v: boolean): void {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    // private mode etc. — toggle just won't persist
  }
  window.dispatchEvent(new Event(ARBITER_CHANGED_EVENT));
}

export function getArbiterWsUrl(): string {
  return useLocalArbiter() ? LOCAL_ARBITER_WS : VM_ARBITER_WS;
}

/** Rewrite a hub-issued arbiter URL to localhost when the toggle is on. */
export function rewriteArbiterUrl(url: string): string {
  if (!useLocalArbiter()) return url;
  if (url.startsWith(VM_ARBITER_HTTP)) {
    return LOCAL_ARBITER_HTTP + url.slice(VM_ARBITER_HTTP.length);
  }
  return url;
}
