// Cloudflare Web Analytics beacon loader (cookieless pageview tracking).
// Details live in infra/web-hosting.md. The beacon auto-tracks SPA route
// changes, so callers must not fire manual pageviews or set "spa": false.
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
  script.src = BEACON_SRC;
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.head.appendChild(script);
  return true;
}
