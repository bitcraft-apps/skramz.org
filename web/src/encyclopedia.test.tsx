import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { queryClient } from "./queryClient";
import { usePlayerStore } from "./stores/playerStore";

const bandPayload = {
  data: { id: "b1", name: "Probe Band", photo_r2_key: "bands/b1/photo.jpg" },
  members: [{ id: "m1", name: "Probe Member" }],
  releases: [{ id: "r1", title: "Probe Release", cover_r2_key: "releases/r1/cover.jpg" }],
  media_links: [],
  sources: [],
};

// App binds the singleton queryClient, so clear its cache between tests —
// otherwise the first test's ["band","b1"] response serves every later test.
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
  localStorage.clear();
  usePlayerStore.setState({
    queue: [],
    current: null,
    isPlaying: false,
    volume: 0.8,
  });
});

function stubApi(payload: unknown = bandPayload) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => payload }) as Response),
  );
}

function renderBand() {
  render(
    <MemoryRouter initialEntries={["/bands/b1"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("encyclopedia band view", () => {
  it("renders the R2 band photo and release cover", async () => {
    stubApi();
    renderBand();
    const photo = await screen.findByAltText("Probe Band photo");
    expect(photo).toHaveAttribute(
      "src",
      "https://media.skramz.org/bands/b1/photo.jpg",
    );
    expect(screen.getByAltText("Probe Release cover")).toHaveAttribute(
      "src",
      "https://media.skramz.org/releases/r1/cover.jpg",
    );
  });

  it("links members and releases to their views", async () => {
    stubApi();
    renderBand();
    await screen.findByText("Probe Band");
    expect(screen.getByRole("link", { name: "Probe Member" })).toHaveAttribute(
      "href",
      "/members/m1",
    );
    expect(screen.getByRole("link", { name: "Probe Release" })).toHaveAttribute(
      "href",
      "/releases/r1",
    );
  });

  it("renders nothing image-like when keys are missing", async () => {
    stubApi({
      ...bandPayload,
      data: { ...bandPayload.data, photo_r2_key: null },
      releases: [{ id: "r1", title: "Probe Release", cover_r2_key: null }],
    });
    renderBand();
    await screen.findByText("Probe Band");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("member role chips", () => {
  const rolesPayload = {
    ...bandPayload,
    members: [
      { id: "m-multi", name: "Multi Player", role: "guitar" },
      { id: "m-multi", name: "Multi Player", role: "vocals" },
      { id: "m-gap", name: "Gap Player", role: null },
    ],
    sources: [],
  };

  function claim(id: string, value: string) {
    return {
      id,
      entity_type: "band_member",
      entity_id: "bm-multi",
      field: "role",
      value,
      status: "confirmed",
      tier: 2,
      source_url: "https://press.example.org/review",
      accessed_at: "2026-10-20",
      created_at: "2026-10-20",
      updated_at: null,
    };
  }

  it("renders one row per person with chips in canonical order", async () => {
    stubApi(rolesPayload);
    renderBand();
    const section = await screen.findByLabelText("members");
    expect(within(section).getAllByRole("listitem")).toHaveLength(2);
    const row = within(section).getByRole("listitem", {
      name: "Multi Player, vocals, guitar",
    });
    // Stored lowercase, CSS-uppercased: chips read vocals-then-guitar.
    const chips = within(row).getAllByText(/^(vocals|guitar)$/);
    expect(chips.map((chip) => chip.textContent)).toEqual(["vocals", "guitar"]);
    for (const chip of chips) expect(chip.className).toContain("uppercase");
  });

  it("renders a name with no chips for a null role", async () => {
    stubApi(rolesPayload);
    renderBand();
    const section = await screen.findByLabelText("members");
    const row = within(section).getByRole("listitem", { name: "Gap Player" });
    expect(within(row).getByRole("link", { name: "Gap Player" })).toBeInTheDocument();
    expect(row.querySelectorAll(".uppercase")).toHaveLength(0);
  });

  it("marks a chipped role on page and an unchipped role rival", async () => {
    stubApi({
      ...rolesPayload,
      sources: [
        {
          id: "c-mb-multi",
          entity_type: "band_member",
          entity_id: "bm-multi",
          field: "membership",
          value: "Multi Player",
          status: "confirmed",
          tier: 2,
          source_url: "https://press.example.org/review",
          accessed_at: "2026-10-20",
          created_at: "2026-10-20",
          updated_at: null,
        },
        claim("c-role-guitar", "guitar"),
        claim("c-role-drums", "drums"),
      ],
    });
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const items = within(ledger).getAllByRole("listitem");
    const withNeedles = (...needles: string[]) =>
      items.find((li) => needles.every((n) => (li.textContent ?? "").includes(n)))!;
    expect(withNeedles("Multi Player", "guitar").textContent).toContain("on page");
    expect(withNeedles("Multi Player", "drums").textContent).not.toContain("on page");
  });
});

describe("band hero", () => {
  const heroPayload = {
    ...bandPayload,
    data: {
      ...bandPayload.data,
      location: "Portland",
      formed_year: 1998,
      disbanded_year: null,
      bio: "Loud basement trio.",
    },
    media_links: [
      {
        id: "l1",
        provider: "bandcamp",
        url: "https://bandcamp.example/x",
        embed_url: "https://embed.example/bc",
      },
    ],
  };

  it("shows location, years, and bio meta when present", async () => {
    stubApi(heroPayload);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(within(hero).getByText("Probe Band")).toBeInTheDocument();
    expect(within(hero).getByText(/Portland/)).toBeInTheDocument();
    expect(within(hero).getByText(/formed 1998/)).toBeInTheDocument();
    expect(
      within(hero).getByText("Loud basement trio."),
    ).toBeInTheDocument();
  });

  it("hides each meta line when its field is blank", async () => {
    stubApi(bandPayload);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(within(hero).queryByText(/Portland/)).not.toBeInTheDocument();
    expect(within(hero).queryByText(/formed/)).not.toBeInTheDocument();
    expect(within(hero).queryByText(/disbanded/)).not.toBeInTheDocument();
  });

  it("plays the first embed through the persistent player queue", async () => {
    const user = userEvent.setup();
    stubApi(heroPayload);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    await user.click(within(hero).getByRole("button", { name: "play" }));
    const s = usePlayerStore.getState();
    expect(s.current).toBe("https://embed.example/bc");
    expect(s.queue).toEqual(["https://embed.example/bc"]);
    expect(s.isPlaying).toBe(true);
    expect(screen.getByTestId("player-embed")).toHaveAttribute(
      "src",
      "https://embed.example/bc",
    );
  });

  it("shows no play button and keeps the empty state with zero embeds", async () => {
    stubApi(bandPayload);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(
      within(hero).queryByRole("button", { name: "play" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText("No streams yet."),
    ).toBeInTheDocument();
    expect(usePlayerStore.getState().current).toBeNull();
  });
});

describe("band evidence", () => {
  const evidenceHero = {
    ...bandPayload,
    data: {
      ...bandPayload.data,
      location: "Portland",
      formed_year: 1998,
      bio: "Loud basement trio.",
      updated_at: null,
    },
    sources: [],
  };

  it("shows one notice instead of per-field markers when sourceless", async () => {
    stubApi(evidenceHero);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(
      within(hero).getByText("no sources recorded — details unconfirmed"),
    ).toBeInTheDocument();
    expect(
      within(hero).queryAllByTitle("unconfirmed: no source recorded"),
    ).toHaveLength(0);
    expect(within(hero).queryByText(/reportedly/)).not.toBeInTheDocument();
  });

  it("keeps a gap marker on unsourced fields once the record has sources", async () => {
    stubApi({
      ...bandPayload,
      data: {
        id: "b1",
        name: "Probe Band",
        location: "Portland",
        formed_year: 1998,
        updated_at: null,
      },
      sources: [
        {
          id: "c1",
          entity_type: "band",
          entity_id: "b1",
          field: "formed_year",
          value: "1998",
          status: "confirmed",
          tier: 2,
          source_url: "https://press.example.org/review",
          accessed_at: "2026-09-01",
          created_at: "2026-09-01",
          updated_at: null,
        },
      ],
    });
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(
      within(hero).queryByText(/no sources recorded/),
    ).not.toBeInTheDocument();
    expect(
      within(hero).getAllByTitle("unconfirmed: no source recorded"),
    ).toHaveLength(1);
  });

  it("keeps the ledger collapsed with an empty state when sourceless", async () => {
    stubApi(evidenceHero);
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    expect(within(ledger).getByText("sources (0)")).toBeInTheDocument();
    expect(
      within(ledger).getByText(
        "No sources recorded — all fields unconfirmed.",
      ),
    ).toBeInTheDocument();
    expect(ledger.querySelector("details")).not.toHaveAttribute("open");
  });

  it("shows a visible disputed marker and auto-expands the ledger", async () => {
    stubApi({
      ...evidenceHero,
      sources: [
        {
          id: "c1",
          entity_type: "band",
          entity_id: "b1",
          field: "bio",
          value: "Loud basement trio.",
          status: "confirmed",
          tier: 2,
          source_url: "https://press.example.org/review",
          accessed_at: "2026-09-01",
          created_at: "2026-09-01",
          updated_at: null,
        },
        {
          id: "c2",
          entity_type: "band",
          entity_id: "b1",
          field: "bio",
          value: "Quiet bedroom project.",
          status: "disputed",
          tier: 3,
          source_url: "https://forum.example.net/thread",
          accessed_at: "2026-10-02",
          created_at: "2026-10-02",
          updated_at: null,
        },
      ],
    });
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(within(hero).getByText("disputed")).toBeInTheDocument();
    const ledger = await screen.findByLabelText("sources");
    expect(ledger.querySelector("details")).toHaveAttribute("open");
    const link = within(ledger).getByRole("link", {
      name: "press.example.org",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://press.example.org/review",
    );
    expect(within(ledger).getByText("2026-09-01")).toBeInTheDocument();
    expect(within(ledger).getByText("T2 reputable")).toBeInTheDocument();
  });

  function ledgerRow(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      entity_type: "band",
      entity_id: "b1",
      field: "bio",
      value: "Loud basement trio.",
      status: "confirmed",
      tier: 2,
      source_url: "https://press.example.org/review",
      accessed_at: "2026-09-01",
      created_at: "2026-09-01",
      updated_at: null,
      ...overrides,
    };
  }

  function manyRows(count: number, disputedIndex = -1) {
    return Array.from({ length: count }, (_, i) =>
      ledgerRow(
        `c${i + 1}`,
        disputedIndex === i
          ? { value: "Quiet bedroom project.", status: "disputed" }
          : {},
      ),
    );
  }

  it("collapses a large ledger but names disputed rows in the summary", async () => {
    stubApi({ ...evidenceHero, sources: manyRows(11, 10) });
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    expect(ledger.querySelector("details")).not.toHaveAttribute("open");
    expect(within(ledger).getByText(/1 disputed: Bio/)).toBeInTheDocument();
  });

  it("collapses a large ledger with no preview when nothing is disputed", async () => {
    stubApi({ ...evidenceHero, sources: manyRows(11) });
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    expect(ledger.querySelector("details")).not.toHaveAttribute("open");
    expect(within(ledger).queryByText(/disputed/)).not.toBeInTheDocument();
  });

  it("auto-expands a ten-row ledger with a dispute (boundary)", async () => {
    stubApi({ ...evidenceHero, sources: manyRows(10, 9) });
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    expect(ledger.querySelector("details")).toHaveAttribute("open");
  });

  it("renders freshness unknown when updated_at is missing", async () => {
    stubApi(evidenceHero);
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(within(hero).getByText("freshness unknown")).toBeInTheDocument();
  });

  it("renders a relative freshness line for a valid updated_at", async () => {
    stubApi({
      ...evidenceHero,
      data: {
        ...evidenceHero.data,
        updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    });
    renderBand();
    const hero = await screen.findByLabelText("band hero");
    expect(within(hero).getByText("updated 3d ago")).toBeInTheDocument();
  });
});

const releasePayload = {
  data: { id: "r1", title: "Probe Release", cover_r2_key: null },
  media_links: [
    {
      id: "l1",
      provider: "bandcamp",
      url: "https://bandcamp.example/x",
      embed_url: "https://embed.example/bc",
    },
    {
      id: "l2",
      provider: "youtube",
      url: "https://youtube.example/y",
      embed_url: null,
    },
  ],
};

function renderRelease() {
  render(
    <MemoryRouter initialEntries={["/releases/r1"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("release listen section", () => {
  it("shows a graceful empty state when there are zero links", async () => {
    stubApi({ ...releasePayload, media_links: [] });
    renderRelease();
    expect(await screen.findByText("No streams yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /play/ })).not.toBeInTheDocument();
  });

  it("dispatches play(embed_url) into the player store", async () => {
    const user = userEvent.setup();
    stubApi(releasePayload);
    renderRelease();
    await user.click(await screen.findByRole("button", { name: "play bandcamp" }));
    const s = usePlayerStore.getState();
    expect(s.current).toBe("https://embed.example/bc");
    expect(s.queue).toEqual(["https://embed.example/bc"]);
    expect(s.isPlaying).toBe(true);
    expect(screen.getByTestId("player-embed")).toHaveAttribute(
      "src",
      "https://embed.example/bc",
    );
  });

  it("renders a fallback outbound link when embed_url is missing", async () => {
    stubApi(releasePayload);
    renderRelease();
    const fallback = await screen.findByRole("link", { name: "youtube" });
    expect(fallback).toHaveAttribute("href", "https://youtube.example/y");
    // Only the embeddable link enters the queue.
    expect(usePlayerStore.getState().queue).toEqual([]);
  });
});

describe("band elsewhere strip", () => {
  const linksPayload = {
    ...bandPayload,
    links: [
      { portal: "musicbrainz", url: "https://musicbrainz.org/artist/1" },
      { portal: "discogs", url: "https://www.discogs.com/artist/1-X" },
      { portal: "rym", url: "https://rateyourmusic.com/artist/x" },
    ],
  };

  it("renders 3 icon buttons with accessible names", async () => {
    stubApi(linksPayload);
    renderBand();
    const strip = await screen.findByLabelText("elsewhere");
    const buttons = within(strip).getAllByRole("link");
    expect(buttons).toHaveLength(3);
    expect(within(strip).getByRole("link", { name: "MusicBrainz" })).toHaveAttribute(
      "href",
      "https://musicbrainz.org/artist/1",
    );
    expect(within(strip).getByRole("link", { name: "Discogs" })).toHaveAttribute(
      "href",
      "https://www.discogs.com/artist/1-X",
    );
    expect(within(strip).getByRole("link", { name: "RateYourMusic" })).toHaveAttribute(
      "href",
      "https://rateyourmusic.com/artist/x",
    );
  });

  it("opens links in a new tab with noopener", async () => {
    stubApi(linksPayload);
    renderBand();
    const strip = await screen.findByLabelText("elsewhere");
    for (const button of within(strip).getAllByRole("link")) {
      expect(button).toHaveAttribute("target", "_blank");
      expect(button.getAttribute("rel")).toContain("noopener");
    }
  });

  it("hides the strip entirely when links is empty", async () => {
    stubApi({ ...bandPayload, links: [] });
    renderBand();
    await screen.findByText("Probe Band");
    expect(screen.queryByLabelText("elsewhere")).not.toBeInTheDocument();
  });

  it("hides the strip when the payload predates links", async () => {
    stubApi(bandPayload);
    renderBand();
    await screen.findByText("Probe Band");
    expect(screen.queryByLabelText("elsewhere")).not.toBeInTheDocument();
  });
});

describe("sources ledger grouping", () => {
  const ledgerPayload = {
    ...bandPayload,
    data: {
      id: "b1",
      name: "Probe Band",
      formed_year: 1996,
      location: "Probe Town",
      updated_at: null,
    },
    members: [
      { id: "m-chris", name: "Chris Story", role: null },
      { id: "m-scott", name: "Scott Batiste", role: "drums" },
      { id: "m-keith", name: "Keith Miller", role: null },
    ],
    // Scrambled on purpose: non-band rows first, people out of order —
    // the ledger must not render raw DB order.
    sources: [
      {
        id: "c-role-chris",
        entity_type: "band_member",
        entity_id: "bm-chris",
        field: "role",
        value: "bass",
        status: "unconfirmed",
        tier: 3,
        source_url: null,
        accessed_at: "2026-10-20",
        created_at: "2026-10-20",
        updated_at: null,
      },
      {
        id: "c-name-b",
        entity_type: "member",
        entity_id: "m-keith",
        field: "name",
        value: "Keith Miller",
        status: "disputed",
        tier: 3,
        source_url: "https://wiki.example/keith",
        accessed_at: "2026-10-20",
        created_at: "2026-10-20",
        updated_at: null,
      },
      {
        id: "c-mb-scott",
        entity_type: "band_member",
        entity_id: "bm-scott",
        field: "membership",
        value: "Scott Batiste",
        status: "confirmed",
        tier: 2,
        source_url: "https://press.example.org/review",
        accessed_at: "2026-10-20",
        created_at: "2026-10-20",
        updated_at: null,
      },
      {
        id: "c-formed-rival",
        entity_type: "band",
        entity_id: "b1",
        field: "formed_year",
        value: "~1997",
        status: "disputed",
        tier: 1,
        source_url: "https://label.example/catalog",
        accessed_at: "2026-10-20",
        created_at: "2026-10-20",
        updated_at: null,
      },
      {
        id: "c-mb-chris",
        entity_type: "band_member",
        entity_id: "bm-chris",
        field: "membership",
        value: "Chris Story",
        status: "confirmed",
        tier: 2,
        source_url: "https://press.example.org/review",
        accessed_at: "2026-10-20",
        created_at: "2026-10-20",
        updated_at: null,
      },
      {
        id: "c-role-scott",
        entity_type: "band_member",
        entity_id: "bm-scott",
        field: "role",
        value: "drums",
        status: "confirmed",
        tier: 1,
        source_url: "https://label.example/catalog",
        accessed_at: "2026-10-20",
        created_at: "2026-10-20",
        updated_at: null,
      },
      {
        id: "c-formed",
        entity_type: "band",
        entity_id: "b1",
        field: "formed_year",
        value: "1996",
        status: "confirmed",
        tier: 2,
        source_url: "https://press.example.org/review",
        accessed_at: "2026-10-20",
        created_at: "2026-10-20",
        updated_at: null,
      },
      {
        id: "c-name-a",
        entity_type: "member",
        entity_id: "m-keith",
        field: "name",
        value: "Keith Milller",
        status: "disputed",
        tier: 2,
        source_url: "https://press.example.org/review",
        accessed_at: "2026-10-20",
        created_at: "2026-10-20",
        updated_at: null,
      },
    ],
  };

  function ledgerItems(ledger: HTMLElement): HTMLElement[] {
    return within(ledger).getAllByRole("listitem");
  }

  function rowWith(items: HTMLElement[], ...needles: string[]): HTMLElement {
    const found = items.find((li) =>
      needles.every((n) => (li.textContent ?? "").includes(n)),
    );
    expect(found).toBeDefined();
    return found!;
  }

  it("groups rows under entity subheads instead of one flat list", async () => {
    stubApi(ledgerPayload);
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const heads = within(ledger)
      .getAllByRole("heading")
      .map((h) => h.textContent);
    expect(heads).toEqual([
      "Band (2)",
      "Membership (2)",
      "Roles (2)",
      "Names (2)",
    ]);
  });

  it("names the subject on every non-band row with no adjacency guessing", async () => {
    stubApi(ledgerPayload);
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const items = ledgerItems(ledger);
    // Role rows resolve to a person through the membership rows, not the
    // stripped join key and not list adjacency.
    expect(
      rowWith(items, "Chris Story", "Role", "bass").textContent,
    ).toContain("Chris Story");
    expect(
      rowWith(items, "Scott Batiste", "Role", "drums").textContent,
    ).toContain("Scott Batiste");
    expect(
      rowWith(items, "Keith Milller").textContent,
    ).toContain("Keith Miller");
  });

  it("marks the on-page value and dims only true rivals", async () => {
    stubApi(ledgerPayload);
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const items = ledgerItems(ledger);
    const yearWinner = rowWith(items, "Formed", "1996");
    expect(yearWinner.textContent).toContain("on page");
    expect(yearWinner.className).not.toContain("opacity-60");
    const yearLoser = rowWith(items, "~1997");
    expect(yearLoser.textContent).not.toContain("on page");
    expect(yearLoser.textContent).toContain("rival");
    expect(yearLoser.className).toContain("opacity-60");
    const nameWinner = items.find(
      (li) =>
        (li.textContent ?? "").includes("Keith Miller") &&
        !(li.textContent ?? "").includes("Milller"),
    );
    expect(nameWinner?.textContent).toContain("on page");
    const nameLoser = rowWith(items, "Milller");
    expect(nameLoser.textContent).not.toContain("on page");
    expect(nameLoser.textContent).toContain("rival");
    expect(nameLoser.className).toContain("opacity-60");
    // Displayed role wins; the unconfirmed lead is not a loser (see below).
    expect(
      rowWith(items, "Scott Batiste", "drums").textContent,
    ).toContain("on page");
  });

  it("sorts band fields first, then member rows alphabetically", async () => {
    stubApi(ledgerPayload);
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const items = ledgerItems(ledger).map((li) => li.textContent ?? "");
    // Band rows first despite scrambled input order.
    expect(items[0]).toContain("Formed");
    const membership = items.filter((t) => t.includes("— Member"));
    expect(membership).toHaveLength(2);
    expect(membership[0]).toContain("Chris Story");
    expect(membership[1]).toContain("Scott Batiste");
  });

  it("renders a membership name once instead of stuttering subject and value", async () => {
    stubApi(ledgerPayload);
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const items = ledgerItems(ledger);
    const row = rowWith(items, "Chris Story", "Member");
    const hits = (row.textContent ?? "").match(/Chris Story/g) ?? [];
    expect(hits).toHaveLength(1);
    expect(row.textContent).toContain("on page");
  });

  it("treats a sole claim against a blank display as a lead, never dimmed", async () => {
    stubApi(ledgerPayload);
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const items = ledgerItems(ledger);
    const lead = rowWith(items, "Chris Story", "bass");
    expect(lead.textContent).toContain("lead");
    expect(lead.textContent).not.toContain("on page");
    expect(lead.className).not.toContain("opacity-60");
  });

  it("orders winners before rivals inside each field group", async () => {
    stubApi(ledgerPayload);
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const texts = ledgerItems(ledger).map((li) => li.textContent ?? "");
    const yearWinner = texts.findIndex(
      (t) => t.includes("Formed") && t.includes("1996"),
    );
    const yearRival = texts.findIndex((t) => t.includes("~1997"));
    expect(yearWinner).toBeGreaterThanOrEqual(0);
    expect(yearRival).toBeGreaterThanOrEqual(0);
    expect(yearWinner).toBeLessThan(yearRival);
    const nameWinner = texts.findIndex(
      (t) => t.includes("Keith Miller") && !t.includes("Milller"),
    );
    const nameRival = texts.findIndex((t) => t.includes("Milller"));
    expect(nameWinner).toBeGreaterThanOrEqual(0);
    expect(nameWinner).toBeLessThan(nameRival);
  });

  it("uses human labels, never raw field tokens", async () => {
    stubApi(ledgerPayload);
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const text = ledger.textContent ?? "";
    expect(text).toContain("Formed");
    expect(text).toContain("Member");
    expect(text).toContain("Role");
    expect(text).toContain("Name");
    expect(text).not.toContain("formed_year");
    expect(text).not.toContain("band_member");
  });

  it("separates a name claim from its subject so a typo row is unambiguous", async () => {
    stubApi(ledgerPayload);
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const items = ledgerItems(ledger);
    expect(rowWith(items, "Milller").textContent).toContain(
      "claimed “Keith Milller”",
    );
  });

  it("renders a NULL attestation as attested text, never a badged em-dash", async () => {
    stubApi({
      ...bandPayload,
      data: {
        ...bandPayload.data,
        bio: "Loud basement trio.",
        updated_at: null,
      },
      sources: [
        {
          id: "c-bio",
          entity_type: "band",
          entity_id: "b1",
          field: "bio",
          value: null,
          status: "confirmed",
          tier: 2,
          source_url: "https://press.example.org/review",
          accessed_at: "2026-09-01",
          created_at: "2026-09-01",
          updated_at: null,
        },
      ],
    });
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const items = ledgerItems(ledger);
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("attests current text");
    expect(items[0].textContent).toContain("on page");
    expect(items[0].textContent).not.toContain("—");
  });

  it("leaves a NULL attestation over a blank display unbadged", async () => {
    stubApi({
      ...bandPayload,
      data: { ...bandPayload.data, bio: null, updated_at: null },
      sources: [
        {
          id: "c-bio",
          entity_type: "band",
          entity_id: "b1",
          field: "bio",
          value: null,
          status: "unconfirmed",
          tier: 3,
          source_url: null,
          accessed_at: null,
          created_at: "2026-09-01",
          updated_at: null,
        },
      ],
    });
    renderBand();
    const ledger = await screen.findByLabelText("sources");
    const items = ledgerItems(ledger);
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("lead");
    expect(items[0].textContent).toContain("no text on page");
    expect(
      within(items[0]).queryByText("on page", { exact: true }),
    ).not.toBeInTheDocument();
    expect(items[0].className).not.toContain("opacity-60");
  });
});
