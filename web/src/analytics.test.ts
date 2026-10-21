import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BEACON_SCRIPT_ID,
  BEACON_SRC,
  beaconToken,
  initWebAnalytics,
} from "./analytics";

afterEach(() => {
  document.getElementById(BEACON_SCRIPT_ID)?.remove();
  vi.unstubAllEnvs();
});

describe("beaconToken", () => {
  it("is empty when the token env var is unset", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "");
    expect(beaconToken()).toBe("");
  });

  it("trims surrounding whitespace", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "  abc123  ");
    expect(beaconToken()).toBe("abc123");
  });
});

describe("initWebAnalytics", () => {
  it("stays silent without a token", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "");
    expect(initWebAnalytics()).toBe(false);
    expect(document.getElementById(BEACON_SCRIPT_ID)).toBeNull();
  });

  it("injects the beacon with the configured token", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "abc123");
    expect(initWebAnalytics()).toBe(true);
    const script = document.getElementById(BEACON_SCRIPT_ID);
    expect(script?.getAttribute("src")).toBe(BEACON_SRC);
    expect(script?.getAttribute("data-cf-beacon")).toBe(
      JSON.stringify({ token: "abc123" }),
    );
  });

  it("injects only once across repeated calls", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "abc123");
    expect(initWebAnalytics()).toBe(true);
    expect(initWebAnalytics()).toBe(true);
    expect(
      document.querySelectorAll(`#${BEACON_SCRIPT_ID}`).length,
    ).toBe(1);
  });

  it("keeps automatic SPA tracking enabled", () => {
    vi.stubEnv("VITE_CF_BEACON_TOKEN", "abc123");
    initWebAnalytics();
    const payload = document
      .getElementById(BEACON_SCRIPT_ID)
      ?.getAttribute("data-cf-beacon");
    expect(payload).not.toContain("spa");
  });
});
