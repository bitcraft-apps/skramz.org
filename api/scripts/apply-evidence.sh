#!/usr/bin/env bash
# Apply one per-band seed file, then fail on any _verify.sql row.
#
# Usage (run from api/ or via `task evidence` / `task evidence:prod`):
#   ./scripts/apply-evidence.sh BAND N [--local|--remote]   # default: --local
set -euo pipefail
cd "$(dirname "$0")/.."

BAND="${1:-}"
N="${2:-}"
MODE="${3:---local}"
if [[ -z "$BAND" || -z "$N" ]]; then
  echo "usage: $0 BAND N [--local|--remote]" >&2
  exit 2
fi
if [[ "$MODE" != "--local" && "$MODE" != "--remote" ]]; then
  echo "usage: $0 BAND N [--local|--remote]" >&2
  exit 2
fi
case "$BAND/$N" in
  *..*|*/*/*) echo "refusing BAND/N with .. or extra separators: seeds/<slug>/<nnn-name.sql>" >&2; exit 2;;
  *.sql) ;;
  *) echo "refusing N without .sql suffix" >&2; exit 2;;
esac

pnpm exec wrangler d1 execute DB "$MODE" --file="seeds/$BAND/$N"
OUT=$(pnpm exec wrangler d1 execute DB "$MODE" --json --file=seeds/_verify.sql)
echo "$OUT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const rows=JSON.parse(s).flatMap(x=>x.results||[]);if(rows.length){for(const r of rows)console.log(JSON.stringify(r));console.error('evidence verify failed: '+rows.length+' row(s)');process.exit(1)}console.log('evidence verify clean')})"
