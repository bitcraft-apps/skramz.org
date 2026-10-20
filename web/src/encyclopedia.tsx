import { Suspense, lazy, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useBand, useMember, useRelease, type BandLink, type ClaimSourceRow } from "./hooks";
import { artUrl } from "./media";
import { usePlayerStore } from "./stores/playerStore";

// Graph loads only with band + graph pages; the player slot never unmounts.
const GraphView = lazy(() => import("./GraphView"));

function str(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

// Non-blank embed_url, or null when the link is outbound-only.
function embedUrl(link: Record<string, unknown>): string | null {
  return typeof link.embed_url === "string" && link.embed_url.trim()
    ? link.embed_url
    : null;
}

// Shared listen section for band + release views. Zero links render a
// graceful empty state instead of an empty list. Rows without an embed_url
// stay playable via their outbound url (fallback link); only embed URLs
// enter the queue.
function ListenList({ links }: { links: Record<string, unknown>[] }) {
  const items = links.filter(
    (link) => typeof link.id === "string" && typeof link.url === "string",
  );
  if (items.length === 0) return <p>No streams yet.</p>;
  const playFrom = (start: string) => {
    const api = usePlayerStore.getState();
    for (const item of items) {
      const embed = embedUrl(item);
      if (embed) api.enqueue(embed);
    }
    api.play(start);
  };
  return (
    <ul>
      {items.map((item) => {
        const embed = embedUrl(item);
        const provider = str(item, "provider") || "listen";
        return embed ? (
          <li key={str(item, "id")}>
            <button type="button" onClick={() => playFrom(embed)}>
              play {provider}
            </button>
          </li>
        ) : (
          <li key={str(item, "id")}>
            <a href={str(item, "url")} target="_blank" rel="noreferrer">
              {provider}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function BandGraphPage() {
  const { id } = useParams();
  return (
    <main aria-label="band graph page" className="w-full">
      <Suspense fallback={<section aria-label="band graph">loading graph</section>}>
        <GraphView id={typeof id === "string" ? id : ""} />
      </Suspense>
    </main>
  );
}

const BTN =
  "zine-border zine-shadow-sm inline-block cursor-pointer bg-paper px-3 py-1 text-sm font-bold uppercase hover:bg-acid";

// External profile icons. MusicBrainz + Discogs brand paths are the official
// marks from Simple Icons (CC0, https://simpleicons.org/icons/musicbrainz.svg
// and https://simpleicons.org/icons/discogs.svg) — never redrawn. RYM has no
// Simple Icons entry, so it falls back to a generic disc glyph plus the text
// label (Wikimedia/official favicon as the next fallback). Add a portal by
// adding one entry here; unknown portals get the generic glyph + their name.
const PORTAL_META: Record<string, { label: string; short: string; path: string | null }> = {
  musicbrainz: {
    label: "MusicBrainz",
    short: "MB",
    path: "M11.582 0L1.418 5.832v12.336L11.582 24V10.01L7.1 12.668v3.664c.01.111.01.225 0 .336-.103.435-.54.804-1 1.111-.802.537-1.752.509-2.166-.111-.413-.62-.141-1.631.666-2.168.384-.28.863-.399 1.334-.332V6.619c0-.154.134-.252.226-.308L11.582 3zm.836 0v6.162c.574.03 1.14.16 1.668.387a2.225 2.225 0 0 0 1.656-.717 1.02 1.02 0 1 1 1.832-.803l.004.006a1.022 1.022 0 0 1-1.295 1.197c-.34.403-.792.698-1.297.85.34.263.641.576.891.928a1.04 1.04 0 0 1 .777.125c.768.486.568 1.657-.318 1.857-.886.2-1.574-.77-1.09-1.539.02-.03.042-.06.065-.09a3.598 3.598 0 0 0-1.436-1.166 4.142 4.142 0 0 0-1.457-.369v4.01c.855.06 1.256.493 1.555.834.227.256.356.39.578.402.323.018.568.008.806 0a5.44 5.44 0 0 1 .895.022c.94-.017 1.272-.226 1.605-.446a2.533 2.533 0 0 1 1.131-.463 1.027 1.027 0 0 1 .12-.263 1.04 1.04 0 0 1 .105-.137c.023-.025.047-.044.07-.066a4.775 4.775 0 0 1 0-2.405l-.012-.01a1.02 1.02 0 0 1 .692.272h-.057a4.288 4.288 0 0 0 0 1.877h.063a1.02 1.02 0 1 1-.545 1.883l-.047-.033a1 1 0 0 1-.352-.442 1.885 1.885 0 0 0-.814.354 3.03 3.03 0 0 1-.703.365c.757.555 1.772 1.6 2.199 2.299a1.03 1.03 0 0 1 .256-.033 1.02 1.02 0 1 1-.545 1.88l-.047-.03a1.017 1.017 0 0 1-.27-1.376.72.72 0 0 1 .051-.072c-.445-.775-2.026-2.28-2.46-2.387a4.037 4.037 0 0 0-1.31-.117c-.24.008-.513.018-.866 0-.515-.027-.783-.333-1.043-.629-.26-.296-.51-.56-1.055-.611V18.5a1.877 1.877 0 0 0 .426-.135.333.333 0 0 1 .058-.027c.56-.267 1.421-.91 2.096-2.447a1.02 1.02 0 0 1-.27-1.344 1.02 1.02 0 1 1 .915 1.54 6.273 6.273 0 0 1-1.432 2.136 1.785 1.785 0 0 1 .691.306.667.667 0 0 0 .37.168 3.31 3.31 0 0 0 .888-.222 1.02 1.02 0 0 1 1.787-.79v-.005a1.02 1.02 0 0 1-.773 1.683 1.022 1.022 0 0 1-.719-.287 3.935 3.935 0 0 1-1.168.287h-.05a1.313 1.313 0 0 1-.71-.275c-.262-.177-.51-.345-1.402-.12a2.098 2.098 0 0 1-.707.2V24l10.164-5.832V5.832zm4.154 4.904a.352.352 0 0 0-.197.639l.018.01c.163.1.378.053.484-.108v-.002a.352.352 0 0 0-.303-.539zm-4.99 1.928L7.082 9.5v2l4.5-2.668zm8.385.38a.352.352 0 0 0-.295.165v.002a.35.35 0 0 0 .096.473l.013.01a.357.357 0 0 0 .487-.108.352.352 0 0 0-.301-.541zM16.09 8.647a.352.352 0 0 0-.277.163.355.355 0 0 0 .296.54c.482 0 .463-.73-.02-.703zm3.877 2.477a.352.352 0 0 0-.295.164.35.35 0 0 0 .094.475l.015.01a.357.357 0 0 0 .485-.11.352.352 0 0 0-.3-.539zm-4.375 3.594a.352.352 0 0 0-.291.172.35.35 0 0 0-.04.265.352.352 0 1 0 .33-.437zm4.375.789a.352.352 0 0 0-.295.164v.002a.352.352 0 0 0 .094.473l.015.01a.357.357 0 0 0 .485-.108.352.352 0 0 0-.3-.54zm-2.803 2.488v.002a.347.347 0 0 0-.223.084.352.352 0 0 0 .23.62.347.347 0 0 0 .23-.085.348.348 0 0 0 .12-.24.353.353 0 0 0-.35-.38.347.347 0 0 0-.007 0Z",
  },
  discogs: {
    label: "Discogs",
    short: "DISCOGS",
    path: "M1.7422 11.982c0-5.6682 4.61-10.2782 10.2758-10.2782 1.8238 0 3.5372.48 5.0251 1.3175l.8135-1.4879C16.1768.588 14.2474.036 12.1908.0024h-.1944C5.4091.0144.072 5.3107 0 11.886v.1152c.0072 3.4389 1.4567 6.5345 3.7748 8.7207l1.1855-1.2814c-1.9798-1.8743-3.218-4.526-3.218-7.4585zM20.362 3.4053l-1.1543 1.2406c1.903 1.867 3.0885 4.4636 3.0885 7.3361 0 5.6658-4.61 10.2758-10.2758 10.2758-1.783 0-3.4605-.456-4.922-1.2575l-.8542 1.5214c1.7086.9384 3.6692 1.4735 5.7546 1.4759C18.6245 23.9976 24 18.6246 24 11.9988c-.0048-3.3717-1.399-6.4146-3.638-8.5935zM1.963 11.982c0 2.8701 1.2119 5.4619 3.146 7.2953l1.1808-1.2767c-1.591-1.5166-2.587-3.6524-2.587-6.0186 0-4.586 3.7293-8.3152 8.3152-8.3152 1.483 0 2.875.3912 4.082 1.0751l.8351-1.5262C15.481 2.395 13.8034 1.927 12.018 1.927 6.4746 1.9246 1.963 6.4362 1.963 11.982zm18.3702 0c0 4.586-3.7293 8.3152-8.3152 8.3152-1.4327 0-2.7837-.3648-3.962-1.0055l-.852 1.5166c1.4303.7823 3.0718 1.2287 4.814 1.2287 5.5434 0 10.055-4.5116 10.055-10.055 0-2.8077-1.1567-5.3467-3.0165-7.1729l-1.183 1.2743c1.519 1.507 2.4597 3.5924 2.4597 5.8986zm-1.9486 0c0 3.5109-2.8558 6.3642-6.3642 6.3642a6.3286 6.3286 0 01-3.0069-.756l-.8471 1.507c1.147.624 2.4597.9768 3.854.9768 4.4636 0 8.0944-3.6308 8.0944-8.0944 0-2.239-.9143-4.2692-2.3902-5.7378l-1.1783 1.267c1.1351 1.152 1.8383 2.731 1.8383 4.4732zm-14.4586 0c0 2.3014.9671 4.382 2.515 5.8578l1.1734-1.2695c-1.207-1.159-1.9606-2.786-1.9606-4.5883 0-3.5108 2.8557-6.3642 6.3642-6.3642 1.1423 0 2.215.3048 3.1437.8352l.8303-1.5167c-1.1759-.6647-2.5317-1.0487-3.974-1.0487-4.4612 0-8.092 3.6308-8.092 8.0944zm12.5292 0c0 2.4502-1.987 4.4372-4.4372 4.4372a4.4192 4.4192 0 01-2.0614-.5088l-.8351 1.4879a6.1135 6.1135 0 002.8965.727c3.3885 0 6.1434-2.7548 6.1434-6.1433 0-1.6774-.6767-3.1989-1.7686-4.3076l-1.1615 1.2503c.7559.7967 1.2239 1.8718 1.2239 3.0573zm-10.5806 0c0 1.7374.7247 3.3069 1.8886 4.4252L8.92 15.1569l.0144.0144c-.8351-.8063-1.3559-1.9366-1.3559-3.1869 0-2.4502 1.9846-4.4372 4.4372-4.4372.8087 0 1.5646.2184 2.2174.5976l.8207-1.4975a6.097 6.097 0 00-3.0381-.8063c-3.3837-.0048-6.141 2.7525-6.141 6.141zm6.681 0c0 .2952-.2424.5351-.5376.5351-.2952 0-.5375-.24-.5375-.5351 0-.2976.24-.5375.5375-.5375.2952 0 .5375.24.5375.5375zm-3.9405 0c0-1.879 1.5239-3.4029 3.4005-3.4029 1.879 0 3.4005 1.5215 3.4005 3.4029 0 1.879-1.5239 3.4005-3.4005 3.4005S8.6151 13.861 8.6151 11.982zm.1488 0c.0048 1.7974 1.4567 3.2493 3.2517 3.2517 1.795 0 3.254-1.4567 3.254-3.2517-.0023-1.7974-1.4566-3.2517-3.254-3.254-1.795 0-3.2517 1.4566-3.2517 3.254Z",
  },
  rym: {
    label: "RateYourMusic",
    short: "RYM",
    path: null,
  },
};

// Generic disc glyph for portals without an official brand path (RYM,
// unknown portals) — always paired with the text label below.
const GENERIC_DISC_PATH =
  "M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm0 3a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z";

// "Elsewhere" strip: external profile buttons under the band header. Hidden
// entirely when links is empty — no empty box, no layout shift in the player.
function ElsewhereStrip({ links }: { links: BandLink[] }) {
  const items = links.filter(
    (link) => typeof link.portal === "string" && typeof link.url === "string" && link.url,
  );
  if (items.length === 0) return null;
  return (
    <section aria-label="elsewhere" className="mt-3">
      <div className="flex flex-wrap gap-2">
        {items.map((link) => {
          const meta = PORTAL_META[link.portal] ?? {
            label: link.portal,
            short: link.portal.toUpperCase(),
            path: null,
          };
          const path = meta.path ?? GENERIC_DISC_PATH;
          return (
            <a
              key={`${link.portal}:${link.url}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={meta.label}
              title={meta.label}
              className="zine-border zine-shadow-sm inline-flex items-center gap-1 bg-paper px-2 py-1 text-xs font-bold uppercase hover:bg-acid"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d={path} />
              </svg>
              <span>{meta.short}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

const NOTICE =
  "zine-border inline-block bg-acid px-2 py-1 text-sm font-bold uppercase";

function year(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

type FieldStatus = "confirmed" | "unconfirmed" | "disputed";

// Group claim rows for one band by field. Display values stay server-side;
// the client only resolves a quiet per-field status from the rows.
function groupBandSources(
  sources: ClaimSourceRow[],
  bandId: string,
): Map<string, ClaimSourceRow[]> {
  const groups = new Map<string, ClaimSourceRow[]>();
  for (const row of sources) {
    if (row.entity_type !== "band" || row.entity_id !== bandId) continue;
    const list = groups.get(row.field);
    if (list) list.push(row);
    else groups.set(row.field, [row]);
  }
  return groups;
}

function fieldStatus(rows: ClaimSourceRow[] | undefined): FieldStatus {
  if (!rows || rows.length === 0) return "unconfirmed";
  if (rows.some((row) => row.status === "disputed")) return "disputed";
  if (new Set(rows.map((row) => row.value ?? "—")).size > 1) return "disputed";
  return "confirmed";
}

// Single hostname helper for tooltips + ledger links; null when missing
// or unparseable (callers fall back to a neutral label, never raw URLs).
function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function tierLabel(tier: number): string {
  if (tier === 1) return "T1 authoritative";
  if (tier === 2) return "T2 reputable";
  return "T3 community";
}

// Ledger link text: hostname, or a neutral label when unparseable.
function domainLabel(url: string | null): string {
  return hostOf(url) ?? "source";
}

// Quiet per-field marker: compact glyphs for confirmed/unconfirmed, a small
// text badge only for disputed (visible without hover, never color-only).
function FieldMarker({
  status,
  domain,
}: {
  status: FieldStatus;
  domain: string | null;
}) {
  if (status === "disputed") {
    return (
      <span
        className="zine-border ml-2 inline-block bg-acid px-1 text-xs font-bold uppercase"
        title="disputed: sources disagree, see sources below"
      >
        disputed
      </span>
    );
  }
  if (status === "unconfirmed") {
    return (
      <span
        className="ml-2 inline-block text-xs font-bold uppercase"
        title="unconfirmed: no source recorded"
      >
        ? unconfirmed
      </span>
    );
  }
  return (
    <span
      className="ml-2 inline-block text-xs font-bold"
      title={domain ? `confirmed: ${domain}` : "confirmed"}
      aria-label={domain ? `confirmed: ${domain}` : "confirmed"}
    >
      ✓
    </span>
  );
}

// Client-side relative freshness from the already-fetched band.updated_at.
// Null, blank, or unparseable stays an honest gap: freshness unknown.
function freshnessText(updatedAt: unknown): string {
  if (typeof updatedAt !== "string" || !updatedAt.trim()) return "freshness unknown";
  const parsed = Date.parse(updatedAt);
  if (Number.isNaN(parsed)) return "freshness unknown";
  const diffMs = Date.now() - parsed;
  if (diffMs < 0) return "freshness unknown";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "updated just now";
  if (minutes < 60) return `updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `updated ${hours}h ago`;
  return `updated ${Math.floor(hours / 24)}d ago`;
}

function EvidenceLedger({ sources }: { sources: ClaimSourceRow[] }) {
  const disputed = sources.some((row) => row.status === "disputed");
  return (
    <section
      aria-label="sources"
      className="zine-border zine-shadow mt-4 bg-paper p-3"
    >
      <details open={disputed || undefined}>
        <summary className="cursor-pointer text-sm font-bold uppercase">
          sources ({sources.length})
        </summary>
        {sources.length === 0 ? (
          <p className="mt-2 text-sm">
            No sources recorded — all fields unconfirmed.
          </p>
        ) : (
          <ul className="mt-2">
            {sources.map((row) => (
              <li
                key={String(row.id)}
                className="border-t-[3px] border-ink py-2 text-sm"
              >
                <span className="font-bold">{row.field}</span>{" "}
                <span>{row.value ?? "—"}</span>{" "}
                <span className="uppercase">{String(row.status)}</span>{" "}
                <span>{tierLabel(row.tier)}</span>{" "}
                {row.source_url ? (
                  <a
                    href={row.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline hover:bg-acid"
                  >
                    {domainLabel(row.source_url)}
                  </a>
                ) : (
                  <span>—</span>
                )}{" "}
                <span>{row.accessed_at ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}

export function BandView() {
  const { id } = useParams();
  const { data, isPending, isError, isSuccess, refetch } = useBand(id);
  const groups = useMemo(() => {
    if (!data || !Array.isArray(data.sources)) {
      return new Map<string, ClaimSourceRow[]>();
    }
    return groupBandSources(data.sources, str(data.data, "id"));
  }, [data]);
  if (isPending) {
    return (
      <main>
        <p className={NOTICE}>loading</p>
      </main>
    );
  }
  if (isError || !isSuccess) {
    return (
      <main>
        <div className="zine-border zine-shadow bg-paper p-3">
          <p className="text-sm font-bold uppercase">failed to load band</p>
          <div className="mt-2">
            <button type="button" onClick={() => refetch()} className={BTN}>
              retry
            </button>
          </div>
        </div>
      </main>
    );
  }
  const band = data.data;
  const name = str(band, "name");
  const photo = artUrl(band.photo_r2_key);
  const location = str(band, "location").trim();
  const formed = year(band.formed_year);
  const disbanded = year(band.disbanded_year);
  const sources: ClaimSourceRow[] = Array.isArray(data.sources)
    ? data.sources
    : [];
  const statusOf = (field: string): FieldStatus =>
    fieldStatus(groups.get(field));
  const domainOf = (field: string): string | null => {
    const rows = groups.get(field);
    const row = rows?.find(
      (r) => typeof r.source_url === "string" && r.source_url,
    );
    return hostOf(row?.source_url);
  };
  const metaSegments = [
    location && { text: location, field: "location" },
    formed && { text: `formed ${formed}`, field: "formed_year" },
    disbanded && { text: `disbanded ${disbanded}`, field: "disbanded_year" },
  ].filter(
    (segment): segment is { text: string; field: string } => Boolean(segment),
  );
  const bio = str(band, "bio").trim();
  const hasSources = sources.length > 0;
  // One quiet marker per field while the record has any sources (honest
  // gaps). A sourceless record gets a single hero notice instead of the
  // same badge repeated after every line — the ledger already says it all.
  const markerFor = (field: string) => {
    const status = statusOf(field);
    if (status === "unconfirmed" && !hasSources) return null;
    return <FieldMarker status={status} domain={domainOf(field)} />;
  };
  const embeds = data.media_links
    .map(embedUrl)
    .filter((url): url is string => url !== null);
  const playFirst = () => {
    const api = usePlayerStore.getState();
    for (const url of embeds) {
      api.enqueue(url);
    }
    api.play(embeds[0]);
  };
  return (
    <main>
      <section
        aria-label="band hero"
        className="zine-border zine-shadow bg-paper p-4"
      >
        <h1 className="bg-ink text-paper inline-block px-2 py-1 text-2xl font-bold uppercase">
          {name}
        </h1>
        <p className="mt-2 text-xs">{freshnessText(band.updated_at)}</p>
        {!hasSources && (
          <p className="mt-2 text-xs font-bold uppercase">
            no sources recorded — details unconfirmed
          </p>
        )}
        {metaSegments.length > 0 && (
          <p className="mt-2 text-sm font-bold uppercase">
            {metaSegments.map((segment, index) => (
              <span key={segment.field}>
                {index > 0 && " · "}
                {segment.text}
                {markerFor(segment.field)}
              </span>
            ))}
          </p>
        )}
        {photo && (
          <>
            <img
              src={photo}
              alt={`${name} photo`}
              className="zine-border zine-shadow-sm mt-3 w-full"
            />
            {markerFor("photo") && (
              <p className="mt-1 text-xs">{markerFor("photo")}</p>
            )}
          </>
        )}
        {bio && (
          <p className="mt-3 max-w-prose text-sm leading-relaxed">
            {bio}
            {markerFor("bio")}
          </p>
        )}
        {embeds.length > 0 && (
          <div className="mt-3">
            <button type="button" onClick={playFirst} className={BTN}>
              play
            </button>
          </div>
        )}
        <ElsewhereStrip links={data.links ?? []} />
        <p className="mt-3">
          <Link
            to={`/bands/${str(band, "id")}/graph`}
            className="font-bold underline hover:bg-acid"
          >
            relationship map →
          </Link>
        </p>
      </section>
      <section
        aria-label="members"
        className="zine-border zine-shadow mt-4 bg-paper"
      >
        <h2 className="border-b-[3px] border-ink bg-acid px-3 py-1 text-sm font-bold uppercase">
          members
        </h2>
        <ul>
          {data.members.map((m) => (
            <li
              key={str(m, "id")}
              className="border-t-[3px] border-ink first:border-t-0"
            >
              <Link
                to={`/members/${str(m, "id")}`}
                className="block px-3 py-2 font-bold hover:bg-acid"
              >
                {str(m, "name")}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section
        aria-label="releases"
        className="zine-border zine-shadow mt-4 bg-paper"
      >
        <h2 className="border-b-[3px] border-ink bg-acid px-3 py-1 text-sm font-bold uppercase">
          releases
        </h2>
        <ul>
          {data.releases.map((r) => {
            const cover = artUrl(r.cover_r2_key);
            return (
              <li
                key={str(r, "id")}
                className="border-t-[3px] border-ink first:border-t-0"
              >
                <Link
                  to={`/releases/${str(r, "id")}`}
                  className="block px-3 py-2 font-bold hover:bg-acid"
                >
                  {str(r, "title")}
                </Link>
                {cover && <img src={cover} alt={`${str(r, "title")} cover`} />}
              </li>
            );
          })}
        </ul>
      </section>
      <section
        aria-label="listen"
        className="zine-border zine-shadow mt-4 bg-paper p-3"
      >
        <h2 className="text-sm font-bold uppercase">listen</h2>
        <div className="mt-2">
          <ListenList links={data.media_links} />
        </div>
      </section>
      <EvidenceLedger sources={sources} />
    </main>
  );
}

export function MemberView() {
  const { id } = useParams();
  const { data, isSuccess } = useMember(id);
  if (!isSuccess) return <main>loading</main>;
  return (
    <main>
      <h1>{str(data.data, "name")}</h1>
      <h2>bands</h2>
      <ul>
        {data.bands.map((b) => {
          const photo = artUrl(b.photo_r2_key);
          return (
            <li key={str(b, "id")}>
              <Link to={`/bands/${str(b, "id")}`}>{str(b, "name")}</Link>
              {photo && <img src={photo} alt={`${str(b, "name")} photo`} />}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

export function ReleaseView() {
  const { id } = useParams();
  const { data, isSuccess } = useRelease(id);
  if (!isSuccess) return <main>loading</main>;
  const cover = artUrl(data.data.cover_r2_key);
  return (
    <main>
      <h1>{str(data.data, "title")}</h1>
      {cover && <img src={cover} alt={`${str(data.data, "title")} cover`} />}
      <h2>listen</h2>
      <ListenList links={data.media_links} />
    </main>
  );
}
