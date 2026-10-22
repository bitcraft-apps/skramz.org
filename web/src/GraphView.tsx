import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Link, useNavigate } from "react-router-dom";
import { trackEvent } from "./events";
import { useBandGraph } from "./hooks";
import { useGraphUIStore } from "./stores/graphUIStore";

// Never render more than this many nodes; the API already bounds result rows.
const GRAPH_NODE_CAP = 500;

type GraphNode = { id: string; name: string };
type GraphLink = { source: string; target: string; via: string };

// Paint node dots + names directly on canvas. nodeLabel alone is
// hover-only, so names would otherwise be invisible.
function paintNode(node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) {
  const n = node as { x?: number; y?: number; name?: unknown; id?: unknown };
  const x = typeof n.x === "number" ? n.x : 0;
  const y = typeof n.y === "number" ? n.y : 0;
  const label = typeof n.name === "string" && n.name ? n.name : String(n.id ?? "");
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fill();
  const fontSize = Math.max(1, 12 / globalScale);
  ctx.font = `${fontSize}px Sans-Serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, x, y + 7);
}

// Band relationship map: bands linked by shared members (via labels).
// Node clicks navigate client-side.
export function GraphView({ id }: { id: string }) {
  const depth = useGraphUIStore((s) => s.depth);
  const setDepth = useGraphUIStore((s) => s.setDepth);
  const showLabels = useGraphUIStore((s) => s.showLabels);
  const toggleLabels = useGraphUIStore((s) => s.toggleLabels);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBandGraph(id, depth);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 480 });

  // One graph_open per mount: opening the map is the interaction, not
  // depth toggles or node clicks (those stay client-side navigation).
  useEffect(() => {
    trackEvent("graph_open");
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width) || el.clientWidth || 640),
        height: Math.max(1, Math.round(rect.height) || el.clientHeight || 480),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const graph = useMemo((): {
    nodes: GraphNode[];
    links: GraphLink[];
    names: Map<string, string>;
  } => {
    if (!data) return { nodes: [], links: [], names: new Map() };
    const nodes = data.nodes
      .slice(0, GRAPH_NODE_CAP)
      .map((n) => ({ id: n.id, name: n.name }));
    const kept = new Set(nodes.map((n) => n.id));
    const links = data.edges
      .filter((e) => kept.has(e.from) && kept.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, via: e.via }));
    const names = new Map<string, string>(
      nodes.map((n): [string, string] => [n.id, n.name || n.id]),
    );
    return { nodes, links, names };
  }, [data]);
  const nameOf = (nodeId: string): string => graph.names.get(nodeId) ?? nodeId;

  if (isLoading) return <section aria-label="band graph">loading graph</section>;
  if (isError || !data)
    return <section aria-label="band graph">graph unavailable</section>;
  if (graph.nodes.length < 2)
    return (
      <section aria-label="band graph">
        <p>no connections yet</p>
      </section>
    );

  return (
    <section aria-label="band graph" className="w-full">
      <div>
        <label>
          depth
          <select
            aria-label="graph depth"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={toggleLabels}
            aria-label="show via labels"
          />
          via labels
        </label>
      </div>
      {data.nodes.length > GRAPH_NODE_CAP && (
        <p>
          showing first {GRAPH_NODE_CAP} of {data.nodes.length} bands
        </p>
      )}
      <div ref={containerRef} className="h-[70vh] w-full">
        <ForceGraph2D
          width={size.width}
          height={size.height}
          graphData={graph}
          nodeLabel="name"
          nodeCanvasObject={paintNode}
          linkLabel={showLabels ? "via" : undefined}
          linkDirectionalArrowLength={3}
          onNodeClick={(node) => navigate(`/bands/${String(node.id)}`)}
        />
      </div>
      <ul aria-label="graph connections">
        {graph.links.map((l) => (
          <li key={`${l.source}-${l.target}-${l.via}`}>
            <Link to={`/bands/${l.source}`}>{nameOf(l.source)}</Link>
            {" to "}
            <Link to={`/bands/${l.target}`}>{nameOf(l.target)}</Link>
            {showLabels ? ` via ${l.via}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default GraphView;
