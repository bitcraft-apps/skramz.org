import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL } from "./api";
import { trackEvent } from "./events";

const ENDPOINT = `${API_URL}/api/events`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("trackEvent", () => {
  it("prefers sendBeacon and skips fetch when the beacon queues", () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon });
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true }) as unknown as Promise<Response>,
    );
    vi.stubGlobal("fetch", fetchSpy);

    trackEvent("play", "/bands/abc");

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe(ENDPOINT);
    expect(blob.type).toBe("application/json");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to a keepalive fetch POST when sendBeacon is missing", async () => {
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    trackEvent("search", "/?q=xyz");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(String(init.body))).toEqual({
      action: "search",
      path: "/?q=xyz",
    });
    await Promise.resolve();
  });

  it("falls back to fetch when sendBeacon declines the payload", () => {
    vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => false) });
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }) as unknown as Promise<Response>);
    vi.stubGlobal("fetch", fetchMock);

    trackEvent("graph_open", "/bands/abc/graph");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("defaults the path to the current location", () => {
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }) as unknown as Promise<Response>);
    vi.stubGlobal("fetch", fetchMock);

    trackEvent("page_view");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { action: string; path: string };
    expect(body.action).toBe("page_view");
    expect(body.path.startsWith("/")).toBe(true);
  });

  it("stays silent when fetch rejects", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    expect(() => trackEvent("play", "/")).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("stays silent when sendBeacon throws", () => {
    vi.stubGlobal(
      "navigator",
      {
        sendBeacon: () => {
          throw new Error("blocked");
        },
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    expect(() => trackEvent("play", "/")).not.toThrow();
  });

  it("never blocks the caller: returns void without awaiting the request", () => {
    vi.stubGlobal("navigator", {});
    let settled = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => setTimeout(() => {
            settled = true;
            resolve({ ok: true });
          }, 20)) as unknown as Promise<Response>,
      ),
    );

    const result: unknown = trackEvent("play", "/");
    expect(result).toBeUndefined();
    expect(settled).toBe(false);
  });
});
