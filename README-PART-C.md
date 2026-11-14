## Part C: The Presentation Layer

Owns everything the user sees: command-line argument parsing, the colored
terminal report, progress indication, and file exports (`report.json` and a
browser dashboard `index.html`).

### Usage

```bash
strata analyze ./my-repo --author="Mahin" --since="2025-01-01" --export=both
```

| Option | Effect |
| --- | --- |
| `--author="Name"` | keep only commits whose author contains this text (case-insensitive) |
| `--since="YYYY-MM-DD"` | keep only commits on or after this date |
| `--export=json\|html\|both` | also write `report.json` and/or `index.html` |
| `--out=DIR` | folder for exported files (default: current directory) |
| `--limit=N` | rows shown per terminal table (default 10) |

### How it fits together

```
git repo --(Part A: strata.js)--> commits[] --(Part B: analyzer.js)--> results
                                                                      |
                                              (Part C: cli.js) <------+
                                                  |            |
                                          terminal report   report.json / index.html
```

- `cli.js` — entry point. Parses arguments, runs Part A, applies the
  `--author` / `--since` filters (with a progress bar, since big repos take
  time), calls Part B, then renders and exports.
- `terminal-ui.js` — prints the summary, churn-hotspot, temporal-coupling
  and knowledge-silo tables with colored output (bus-factor risks in red).
- `exporter.js` — writes a clean `report.json`, and injects the results into
  `template.html` with the mustache templating engine; charts are drawn in
  the browser with Chart.js.
- `template.html` — the dashboard template (summary cards + graphs + tables).

### Libraries

- `chalk` — colored terminal text
- `cli-progress` — the filtering progress bar
- `cli-table3` — ASCII tables
- `mustache` — HTML templating
- Chart.js (vendored in `vendor/` and inlined into the HTML) — browser graphs, works offline.
  MIT License, (c) 2014-2024 Chart.js Contributors; full text in `vendor/chart.js.LICENSE.md`
