# Strata - Git Repository History Analysis

Strata is a command-line tool that analyses the commit history of any Git repository and reports on the overall health of the codebase. Instead of merely inspecting what the code currently looks like, Strata examines how the code has changed over time:
- **Churn & Hotspots**: Which files are rewritten most frequently.
- **Temporal Coupling**: Which files are always modified together.
- **Knowledge Silos / Bus Factor**: Which files depend heavily on a single contributor.

Strata provides actionable insights through a single command, outputting a coloured terminal report alongside JSON and HTML exports for use in dashboards and CI/CD pipelines.

---

## Architecture Overview

The project is split into three main modules:

1. **Data Extraction & Parsing** (`strata.js`): Executes Git commands to retrieve raw history and parse commits, author data, and file diff statistics.
2. **Analytics & Metrics ("The Brain")** (`analyzer.js`): Processes parsed commit objects into actionable architectural and collaboration metrics.
3. **CLI & Exports**: Handles user arguments, terminal formatting, and export generation (JSON/HTML).

---

## Analytics Engine (The Brain)

This module is responsible for the core analytics computations:
- Consumes structured commit objects.
- Computes repository health metrics (churn rate, coupling matrix, author ownership distributions).
- Returns structured analytics ready for reporting and exports.

### Foundation Setup

- **[`mockData.json`](./mockData.json)**: Sample commit datasets matching the parsed Git schema for offline testing and verification.
- **[`analyzer.js`](./analyzer.js)**: The core analytics script and entry point for metric calculations (`analyzeRepository`).

### Implemented Metrics

#### Code Churn (Hotspots)
Tracks file modification frequency, cumulative insertions, and cumulative deletions across commit history to detect frequently rewritten components:
- **Safeguard Handling**: Automatically ignores empty commits or commits missing a file list.
- **Hotspot Ranking**: Results are sorted in descending order by modification frequency.

**Output Schema:**
```json
{
  "name": "src/auth/login.js",
  "frequency": 2,
  "insertions": 55,
  "deletions": 14
}
```

#### Temporal Coupling
Detects hidden architectural dependencies by identifying pairs of files that are frequently modified together within the same commit:
- **Safeguard Handling**: Automatically ignores commits with more than 30 files to prevent noise from linters, code formatters, and bulk dependency updates.
- **Noise Filtering**: Filters out pairs that only co-occurred once (`count < 2`) to ensure reported relationships represent consistent patterns.
- **Directional Coupling**: Computes percentages (`percentage_file1`, `percentage_file2`) showing how often modifying File A also required modifying File B, and vice versa.
- **Ranking**: Sorted primarily by co-change count in descending order, with ties broken by `percentage_file1`.

**Output Schema:**
```json
{
  "file1": "src/auth/login.js",
  "file2": "src/utils/api.js",
  "count": 5,
  "percentage_file1": 83,
  "percentage_file2": 100
}
```

### Running the Analyzer

Run the analytics engine with Node.js:

```bash
node analyzer.js
```
