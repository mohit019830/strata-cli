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

### Running the Analyzer

Run the analytics engine with Node.js:

```bash
node analyzer.js
```
