// Cloudflare Web Analytics beacon loader (cookieless pageview tracking).
//
// The beacon script reports to static.cloudflareinsights.com, never to the
// Workers/D1 stack, so it costs zero request/CPU/row-read quota. SPA route
// changes are picked up automatically by the beacon (Soft Navigations API,
// Navigation API, or patched pushState + popstate), so callers must not fire
// manual pageviews and must not opt out via "spa": false.
export const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";
export const BEACON_SCRIPT_ID = "cf-web-analytics-beacon";

export function beaconToken(): string {
  return (import.meta.env.VITE_CF_BEACON_TOKEN ?? "").trim();
}

// Injects the beacon once when a token is configured. Returns true when the
// beacon is present (already injected counts), false when no token is set —
// local dev and token-less previews stay silent.
export function initWebAnalytics(): boolean {
  const token = beaconToken();
  if (token === "") return false;
  if (document.getElementById(BEACON_SCRIPT_ID)) return true;
  const script = document.createElement("script");
  script.id = BEACON_SCRIPT_ID;
  script.defer = true;
  script.src = BEACON_SRC;
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.head.appendChild(script);
  return true;
}
