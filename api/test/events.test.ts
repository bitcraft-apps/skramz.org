import { describe, expect, it, vi } from "vitest";
import { createApp, type AnalyticsEngineDataset, type D1Database, type D1PreparedStatement } from "../src/index";

function stmt(): D1PreparedStatement {
  const s: D1PreparedStatement = {
    bind(..._values: unknown[]) {
      return s;
    },
    first: async <T,>(): Promise<T | null> => null,
    all: async <T,>(): Promise<{ results: T[] }> => ({ results: [] }),
    run: async (): Promise<unknown> => ({}),
  };
  return s;
}

const db: D1Database = { prepare: () => stmt() };

function post(body: unknown, events?: AnalyticsEngineDataset) {
  const app = createApp();
  return app.request(
    "/api/events",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
    { DB: db, ...(events ? { EVENTS: events } : {}) },
  );
}

describe("POST /api/events", () => {
  it("accepts a tracked action and writes one data point", async () => {
    const writeDataPoint = vi.fn();
    const res = await post({ action: "play", path: "/bands/abc" }, { writeDataPoint });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith({
      blobs: ["play", "/bands/abc"],
      doubles: [1],
      indexes: ["play"],
    });
  });

  it.each(["page_view", "play", "graph_open", "search"])(
    "accepts the tracked action %s",
    async (action) => {
      const writeDataPoint = vi.fn();
      const res = await post({ action, path: "/" }, { writeDataPoint });
      expect(res.status).toBe(202);
      expect(writeDataPoint).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects an unknown action without writing", async () => {
    const writeDataPoint = vi.fn();
    const res = await post({ action: "purchase", path: "/" }, { writeDataPoint });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "invalid_action", message: "Action is not tracked" },
    });
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("drops extra fields instead of storing them", async () => {
    const writeDataPoint = vi.fn();
    const res = await post(
      { action: "search", path: "/?q=x", query: "x", admin: true },
      { writeDataPoint },
    );
    expect(res.status).toBe(202);
    expect(writeDataPoint).toHaveBeenCalledWith({
      blobs: ["search", "/?q=x"],
      doubles: [1],
      indexes: ["search"],
    });
  });

  it("rejects a non-relative path without writing", async () => {
    const writeDataPoint = vi.fn();
    for (const path of ["https://evil.example/", "no-slash", ""]) {
      const res = await post({ action: "play", path }, { writeDataPoint });
      expect(res.status).toBe(400);
    }
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed body and an empty body", async () => {
    const writeDataPoint = vi.fn();
    const malformed = await post("not-json{", { writeDataPoint });
    expect(malformed.status).toBe(400);
    const array = await post([1, 2], { writeDataPoint });
    expect(array.status).toBe(400);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("still answers 202 when the dataset binding is missing", async () => {
    const res = await post({ action: "play", path: "/" });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("still answers 202 when the write throws", async () => {
    const res = await post(
      { action: "play", path: "/" },
      {
        writeDataPoint: () => {
          throw new Error("quota");
        },
      },
    );
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });
  });
});
