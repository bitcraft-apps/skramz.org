import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useMatch } from "react-router-dom";
import { PlayerSlot } from "./PlayerSlot";
import { trackEvent } from "./events";
import { BandGraphPage, BandView, MemberView, ReleaseView } from "./encyclopedia";
import { useBands, useSearch, type SearchResult } from "./hooks";
import { queryClient } from "./queryClient";

const GROUP_CAP = 5;

type Hit = SearchResult["hits"][number];

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function hitHref(hit: Hit): string {
  const id = str(hit.id);
  if (hit.type === "member") return `/members/${id}`;
  if (hit.type === "release") return `/releases/${id}`;
  return `/bands/${id}`;
}

const BTN =
  "zine-border zine-shadow-sm inline-block cursor-pointer bg-paper px-3 py-1 text-sm font-bold uppercase hover:bg-acid";

const NOTICE =
  "zine-border inline-block bg-acid px-2 py-1 text-sm font-bold uppercase";

// Search-first gateway: an idle band strip plus debounced unified search
// grouped into bands / members / releases.
export function Home() {
  const [raw, setRaw] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(raw), 300);
    return () => clearTimeout(timer);
  }, [raw]);
  const query = debounced.trim();
  const searching = query.length >= 2;
  const idle = useBands(!searching);
  const search = useSearch(searching ? query : "");
  const reset = () => {
    setRaw("");
    setDebounced("");
  };
  // One search event per debounced query, fired when results land — never
  // per keystroke, and never before the query succeeds.
  const lastTrackedQuery = useRef("");
  useEffect(() => {
    if (searching && search.data && lastTrackedQuery.current !== query) {
      lastTrackedQuery.current = query;
      trackEvent("search", `/?q=${encodeURIComponent(query)}`);
    }
  }, [searching, search.data, query]);

  // Skip id-less hits: there is nothing to link to, and coercing a
  // missing id to "" would hand same-type rows the same React key.
  const hits = (search.data?.hits ?? []).filter((hit) => str(hit.id) !== "");
  const groups = (
    [
      ["bands", "band"],
      ["members", "member"],
      ["releases", "release"],
    ] as const
  )
    .map(([heading, type]) => ({
      heading,
      items: hits.filter((hit) => hit.type === type).slice(0, GROUP_CAP),
    }))
    .filter((group) => group.items.length > 0);
  // Skip id-less records: there is nothing to link to, and coercing a
  // missing id to "" would hand every such row the same React key.
  const idleBands = (idle.data?.data ?? []).filter(
    (band) => str(band.id) !== "",
  );

  return (
    <main>
      <h1 className="bg-ink text-paper inline-block px-2 py-1 text-2xl font-bold uppercase">
        dig through the noise
      </h1>
      <div className="mt-4">
        <input
          type="search"
          aria-label="search"
          placeholder="search bands, members, releases"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          className="zine-border zine-shadow w-full bg-white px-3 py-2 text-lg font-bold placeholder:font-normal"
        />
      </div>
      {searching ? (
        <div className="mt-4">
          {search.isPending ? (
            <p className={NOTICE}>loading</p>
          ) : search.isError ? (
            <div className="zine-border zine-shadow bg-paper p-3">
              <p className="text-sm font-bold uppercase">search failed</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => search.refetch()}
                  className={BTN}
                >
                  retry
                </button>
                <button type="button" onClick={reset} className={BTN}>
                  reset
                </button>
              </div>
            </div>
          ) : hits.length === 0 ? (
            <div className="zine-border zine-shadow bg-paper p-3">
              <p className="text-sm font-bold uppercase">no results</p>
              <div className="mt-2">
                <button type="button" onClick={reset} className={BTN}>
                  reset
                </button>
              </div>
            </div>
          ) : (
            groups.map((group) => (
              <section
                key={group.heading}
                aria-label={group.heading}
                className="zine-border zine-shadow mt-4 bg-paper"
              >
                <h2 className="border-b-[3px] border-ink bg-acid px-3 py-1 text-sm font-bold uppercase">
                  {group.heading}
                </h2>
                <ul>
                  {group.items.map((hit) => (
                    <li
                      key={`${hit.type}:${str(hit.id)}`}
                      className="border-t-[3px] border-ink first:border-t-0"
                    >
                      <Link
                        to={hitHref(hit)}
                        className="block px-3 py-2 font-bold hover:bg-acid"
                      >
                        {str(hit.name) || str(hit.id)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      ) : (
        <div className="mt-4">
          {raw.trim().length > 0 && (
            <p className={`${NOTICE} mb-3`}>keep typing</p>
          )}
          {idle.isPending ? (
            <p className={NOTICE}>loading</p>
          ) : idle.isError ? (
            <div className="zine-border zine-shadow bg-paper p-3">
              <p className="text-sm font-bold uppercase">failed to load bands</p>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => idle.refetch()}
                  className={BTN}
                >
                  retry
                </button>
              </div>
            </div>
          ) : idleBands.length === 0 ? (
            <p className={NOTICE}>no bands yet</p>
          ) : (
            <section className="zine-border zine-shadow bg-paper">
              <h2 className="border-b-[3px] border-ink bg-acid px-3 py-1 text-sm font-bold uppercase">
                latest bands
              </h2>
              <ul>
                {idleBands.map((band) => {
                  const id = str(band.id);
                  const name = str(band.name) || id;
                  return (
                    <li
                      key={id}
                      className="border-t-[3px] border-ink first:border-t-0"
                    >
                      <Link
                        to={`/bands/${id}`}
                        className="block px-3 py-2 font-bold hover:bg-acid"
                      >
                        {name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function About() {
  return (
    <main className="zine-border zine-shadow bg-paper p-4">
      <h1 className="bg-ink text-paper inline-block px-2 py-1 text-xl font-bold uppercase">
        about
      </h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed">
        skramz.org is a DIY encyclopedia of bands, members, and releases.
        search the gateway, follow the links, keep the player running.
      </p>
    </main>
  );
}

// One page_view per SPA route change for the custom-event dataset (Analytics
// Engine), so page views and interactions share one funnel source. Separate
// from the Web Analytics beacon, which tracks its own pageviews and needs no
// manual calls (see analytics.ts).
function TrackPageView() {
  const location = useLocation();
  useEffect(() => {
    trackEvent("page_view", location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

// Root shell: nav + persistent player slot never unmount across routes;
// only the <Routes> outlet swaps.
export function App() {
  // The graph page needs the full viewport width, so it skips the
  // max-w-3xl content wrapper every other route uses.
  const isGraphPage = useMatch("/bands/:id/graph") !== null;
  return (
    <QueryClientProvider client={queryClient}>
      <TrackPageView />
      <header className="border-b-[3px] border-ink bg-ink text-paper">
        <div className="mx-auto flex max-w-3xl flex-wrap items-baseline gap-x-5 px-4 py-3">
          <span className="text-xl font-bold uppercase tracking-tight">
            skramz<span className="text-acid">.org</span>
          </span>
          <nav className="flex gap-4 text-sm font-bold uppercase">
            <Link to="/" className="px-1 underline hover:bg-acid hover:text-ink">
              home
            </Link>
            <Link
              to="/about"
              className="px-1 underline hover:bg-acid hover:text-ink"
            >
              about
            </Link>
          </nav>
        </div>
      </header>
      <div className="border-b-[3px] border-ink bg-paper">
        <div className="mx-auto max-w-3xl px-4 py-2">
          <PlayerSlot />
        </div>
      </div>
      <div className={isGraphPage ? "w-full" : "mx-auto max-w-3xl px-4 py-6"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/bands/:id" element={<BandView />} />
          <Route path="/bands/:id/graph" element={<BandGraphPage />} />
          <Route path="/members/:id" element={<MemberView />} />
          <Route path="/releases/:id" element={<ReleaseView />} />
        </Routes>
      </div>
    </QueryClientProvider>
  );
}
