#!/usr/bin/env bash
# run-tests.sh - reproducible Part C test suite
# Builds a synthetic git repo with known ground truth, then exercises the CLI.
#
# Safety: this runner NEVER touches the working tree it is invoked from.
# It assembles an isolated integration copy in a temp dir (Part C files +
# teammate modules) and runs everything there, so teammates' or Aman's
# uncommitted work cannot be overwritten.
#
# Integration preparation: Part C is tested against the REAL teammate
# modules, pinned to the exact commits below (not whatever the branches
# happen to contain later). Update these deliberately when the team
# advances their branches, and re-run the suite before trusting it:
PARSER_COMMIT=7f10064a81932e07cb840274311e1bd446e2609f   # parser branch tip, tested 2026-11-14
ENGINE_COMMIT=54def14e11f09a90043359bdd0f85617757c089e   # engine branch tip, tested 2026-11-14
#
# Note: Part A's quick-test block prints on import until the team applies
# the require.main guard at merge time (see strata-part-a-guard.patch).
# It is noise on stdout, not a failure.
#
# Usage: ./run-tests.sh   (from the Part C folder; safe inside the team repo)
set -u
SRC="$(cd "$(dirname "$0")" && pwd)"

# --- assemble the isolated integration copy --------------------------------
WORK=$(mktemp -d /tmp/strata-integration.XXXXXX)
trap 'rm -rf "$WORK"' EXIT
cp "$SRC"/cli.js "$SRC"/terminal-ui.js "$SRC"/exporter.js "$SRC"/template.html \
   "$SRC"/package.json "$SRC"/package-lock.json "$WORK"/
mkdir -p "$WORK/vendor"
cp "$SRC"/vendor/* "$WORK/vendor"/

# Teammate modules at the pinned commits. Never written into the caller's tree.
if git -C "$SRC" cat-file -e "$PARSER_COMMIT" 2>/dev/null && git -C "$SRC" cat-file -e "$ENGINE_COMMIT" 2>/dev/null; then
  git -C "$SRC" show "$PARSER_COMMIT:strata.js"   > "$WORK/strata.js"   || { echo "ERROR: strata.js not at $PARSER_COMMIT"; exit 1; }
  git -C "$SRC" show "$ENGINE_COMMIT:analyzer.js" > "$WORK/analyzer.js" || { echo "ERROR: analyzer.js not at $ENGINE_COMMIT"; exit 1; }
  echo "Teammate modules pinned: parser=$PARSER_COMMIT engine=$ENGINE_COMMIT"
elif [ -f "$SRC/strata.js" ] && [ -f "$SRC/analyzer.js" ]; then
  # Fallback: files already staged next to the runner (exact copies, e.g. in a
  # shared zip). Record what is actually being tested instead of failing.
  cp "$SRC/strata.js" "$SRC/analyzer.js" "$WORK"/
  echo "Teammate modules taken from local copies next to run-tests.sh (unpinned)."
  echo "For pinned testing, run inside a clone of the team repo."
else
  echo "ERROR: teammate modules unavailable. Either run inside a clone of the"
  echo "team repo (pinned commits are read from git), or place strata.js and"
  echo "analyzer.js from the parser and engine branches next to this script."
  exit 1
fi

# Dependencies: reuse the source folder's install when present, else npm ci
# inside the temp dir (the caller's node_modules is never modified).
if [ -d "$SRC/node_modules" ]; then
  export NODE_PATH="$SRC/node_modules"
else
  ( cd "$WORK" && npm ci --ignore-scripts >/dev/null 2>&1 ) || { echo "ERROR: npm ci failed."; exit 1; }
fi

cd "$WORK"

PASS=0; FAIL=0
DEMO=/tmp/strata-test-repo
OUT=/tmp/strata-test-out

ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

# expect_fail <description> <expected-substring> <command...>
expect_fail() {
  local desc="$1" want="$2"; shift 2
  local out rc
  out=$("$@" 2>&1); rc=$?
  if [ $rc -ne 0 ] && [[ "$out" == *"$want"* ]]; then ok "$desc"
  else bad "$desc (rc=$rc, out: $(echo "$out" | tail -2 | tr '\n' ' '))"; fi
}
# expect_ok <description> <expected-substring> <command...>
expect_ok() {
  local desc="$1" want="$2"; shift 2
  local out rc
  out=$("$@" 2>&1); rc=$?
  if [ $rc -eq 0 ] && [[ "$out" == *"$want"* ]]; then ok "$desc"
  else bad "$desc (rc=$rc, out: $(echo "$out" | tail -3 | tr '\n' ' '))"; fi
}

echo "== building synthetic repo =="
rm -rf "$DEMO" "$OUT"; mkdir -p "$DEMO"
cd "$DEMO" && git init -q
commit() { # author email date msg
  export GIT_AUTHOR_NAME="$1" GIT_AUTHOR_EMAIL="$2" GIT_COMMITTER_NAME="$1" GIT_COMMITTER_EMAIL="$2" \
         GIT_AUTHOR_DATE="$3" GIT_COMMITTER_DATE="$3"
  git add -A && git commit -q -m "$4"
}
for i in 1 2 3 4; do
  mkdir -p src; printf 'line %s\n%.0s' "$i" $(seq 20) >> src/auth.py; printf 'db %s\n%.0s' "$i" $(seq 5) >> src/db.py
  commit Mahin m@x.io "2025-0${i}-15T10:00:00" "auth work $i"
done
printf 'solo\n%.0s' $(seq 30) >> src/auth.py; commit Mahin m@x.io "2025-05-15T10:00:00" "auth solo"
echo hello >> README.md; commit Sara s@x.io "2025-06-01T10:00:00" "readme"
mkdir -p src; printf 'ui\n%.0s' $(seq 10) >> src/ui.py; commit Sara s@x.io "2025-06-02T10:00:00" "ui start"
printf 'ui2\n%.0s' $(seq 15) >> src/ui.py; printf 'tw\n%.0s' $(seq 2) >> src/db.py; commit Aman a@x.io "2025-06-10T10:00:00" "ui more"
printf 'old\n%.0s' $(seq 3) >> src/old.py; commit Aman a@x.io "2024-12-01T10:00:00" "old commit"
# hostile filename and author for escaping tests
mkdir -p 'src/evil</script><script>alert(1)</script>'
echo x >> 'src/evil</script><script>alert(1)</script>/x.js'
commit '<b>Evil & Co</b>' e@x.io "2025-07-01T10:00:00" "hostile"
cd - >/dev/null

echo "== happy path =="
expect_ok  "full run exits 0 with summary"        "Commits:      10"        node cli.js analyze "$DEMO"
expect_ok  "coupling pair detected"               "src/auth.py"             node cli.js analyze "$DEMO"
expect_ok  "author filter keeps subset"           "5 of 10 commits"         node cli.js analyze "$DEMO" --author=Mahin
expect_ok  "author filter shows scope note"       "cover only that subset"  node cli.js analyze "$DEMO" --author=Mahin
expect_ok  "since filter drops old commit"        "9 of 10 commits"        node cli.js analyze "$DEMO" --since=2025-01-01
expect_ok  "no-match filter exits 0"              "Nothing to analyze"      node cli.js analyze "$DEMO" --author=Nobody
expect_ok  "path with spaces works"               "Commits:"                node cli.js analyze "$DEMO" --out="$OUT/with space dir" --export=json

echo "== bad input handling =="
expect_fail "unknown flag rejected"               'unknown option "--bogus"'        node cli.js analyze "$DEMO" --bogus=1
expect_fail "missing flag value rejected"         'needs a value'                   node cli.js analyze "$DEMO" --author
expect_fail "empty flag value rejected"           'empty value'                     node cli.js analyze "$DEMO" --author=
expect_fail "invalid since rejected"              'not a valid date'                node cli.js analyze "$DEMO" --since=2025-13-40
expect_fail "garbage since rejected"              'not a valid date'                node cli.js analyze "$DEMO" --since=banana
expect_fail "invalid export mode rejected"        'not valid. Use json'             node cli.js analyze "$DEMO" --export=xml
expect_fail "non-numeric limit rejected"          'not valid. Use a positive'       node cli.js analyze "$DEMO" --limit=abc
expect_fail "zero limit rejected"                 'not valid. Use a positive'       node cli.js analyze "$DEMO" --limit=0
expect_fail "negative limit rejected"             'not valid. Use a positive'       node cli.js analyze "$DEMO" --limit=-3
expect_fail "extra bare argument rejected"        'unexpected extra argument'       node cli.js analyze "$DEMO" extra-arg
expect_fail "missing path exits 1"                'No commits found'                node cli.js analyze /tmp/definitely-not-here-xyz
expect_fail "non-repo folder exits 1"             'No commits found'                node cli.js analyze /tmp
expect_fail "unwritable out dir fails cleanly"    'could not write the export'      node cli.js analyze "$DEMO" --export=json --out=/sys/readonly-x
expect_fail "out path that is a file fails"       'could not write the export'      node cli.js analyze "$DEMO" --export=json --out=/etc/hostname
# /proc export must fail fast, never hang: timeout is the backstop, rc=124 means hung.
out=$(timeout 20 node cli.js analyze "$DEMO" --export=json --out=/proc/cannot-write-here 2>&1); rc=$?
if [ $rc -eq 1 ] && [[ "$out" == *"could not write the export"* ]]; then ok "procfs export fails fast (no hang)"
else bad "procfs export fails fast (rc=$rc - 124 means it hung)"; fi

echo "== exports =="
node cli.js analyze "$DEMO" --export=both --out="$OUT" >/dev/null 2>&1
node -e "
const fs=require('fs');
const r=JSON.parse(fs.readFileSync('$OUT/report.json','utf8'));
const need=['summary','churn','coupling','ownership'];
if(!need.every(k=>k in r)) { console.log('FAIL: report.json schema keys'); process.exit(1); }
const auth=r.ownership.find(o=>o.file==='src/auth.py');
if(!auth || auth.primaryOwner!=='Mahin' || auth.ownershipPercentage!==100) { console.log('FAIL: ownership ground truth'); process.exit(1); }
const pair=r.coupling.find(p=>p.file1==='src/auth.py'&&p.file2==='src/db.py');
if(!pair || pair.count!==4 || pair.percentage_file1!==80 || pair.percentage_file2!==80) { console.log('FAIL: coupling ground truth', JSON.stringify(pair)); process.exit(1); }
if(r.summary.totalCommits!==10 || r.summary.totalContributors!==4) { console.log('FAIL: summary ground truth'); process.exit(1); }
console.log('PASS: report.json schema + ground-truth values');
" || FAIL=$((FAIL+1))
node -e "
const fs=require('fs');
const h=fs.readFileSync('$OUT/index.html','utf8');
if(h.includes('</script><script>alert(1)</script>')) { console.log('FAIL: script-breakout in chart data'); process.exit(1); }
if(!h.includes('evil&lt;&#x2F;script&gt;')) { console.log('FAIL: hostile filename not escaped in table'); process.exit(1); }
if(h.includes('<b>Evil & Co</b>')) { console.log('FAIL: hostile author not escaped'); process.exit(1); }
if(h.includes('cdn.jsdelivr.net')) { console.log('FAIL: still depends on CDN'); process.exit(1); }
if(!h.includes('Chart')) { console.log('FAIL: chart lib not inlined'); process.exit(1); }
console.log('PASS: HTML escaping + offline chart bundle');
" || FAIL=$((FAIL+1))

echo "== missing teammate modules =="
TM=/tmp/strata-partc-only; rm -rf "$TM"; mkdir -p "$TM"
cp "$WORK"/cli.js "$WORK"/terminal-ui.js "$WORK"/exporter.js "$WORK"/template.html "$WORK"/package.json "$TM"/
mkdir -p "$TM/vendor"; cp "$WORK"/vendor/chart.umd.min.js "$TM/vendor/"
expect_fail "absent Part A/B fails helpfully" "parser and engine branches" bash -c "cd '$TM' && npm install --silent >/dev/null 2>&1; unset NODE_PATH; node cli.js analyze '$DEMO'"

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ]
