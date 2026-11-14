# Strata - Git Repository History Analysis

Strata is a command-line tool that analyses the commit history of any Git repository and reports on the overall health of the codebase. Instead of examining what the code currently looks like, it examines how the code has changed over time:

- **Churn & Hotspots**: Which files are rewritten most frequently and accumulate high line turnover.
- **Temporal Coupling**: Which files are consistently committed together, exposing hidden architectural dependencies.
- **Knowledge Silos / Bus Factor**: Which files depend heavily on a single developer (>= 80% ownership share).

Strata produces an interactive colored terminal report alongside standalone JSON and offline HTML dashboards for use in developer reviews and CI/CD pipelines.

---

## Architecture Overview

The system is built as a three-tier modular pipeline:

```
Local Git Repo
      │
      ▼ (Part A: Data Extraction & Parsing - strata.js)
  commits[]  { hash, author, timestamp, message, files: [{ name, insertions, deletions }] }
      │
      ▼ (Part B: Analytics Engine / "The Brain" - analyzer.js)
  results    { summary, churn[], coupling[], ownership[] }
      │
      ▼ (Part C: Presentation Layer - cli.js)
  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  ▼                                                        ▼
Terminal UI (terminal-ui.js)              Exporters (exporter.js)
- Summary KPIs                            - report.json
- Health verdict banner                   - index.html (template.html + Chart.js)
- ASCII bar charts & tables
```

1. **Data Extraction & Parsing (`strata.js`)**: Validates the repository directory, executes `git log` with custom delimiter formatting and `--numstat`, and parses raw git history into structured commit objects while handling binary and mode-only files.
2. **Analytics Engine ("The Brain", `analyzer.js`)**: Consumes structured commit arrays, validates inputs, and calculates churn ranking, co-change temporal coupling matrices, and lines-changed-weighted code ownership.
3. **Presentation Layer (`cli.js`, `terminal-ui.js`, `exporter.js`)**: Coordinates argument parsing, progress tracking, colored terminal reporting (`cli-table3`, `chalk`), and exports report files.

---

## Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Git](https://git-scm.com/) installed and available in your `PATH`

### Installation
Clone the repository and install runtime dependencies:

```bash
git clone https://github.com/mohit019830/strata-cli.git
cd strata-cli
npm install
```

Make the CLI binary executable:
```bash
chmod +x cli.js
```

---

## Usage

Strata analyzes local directories containing a `.git` repository (no remote URL required).

```bash
./cli.js analyze <repo-path> [options]
```
*(or `node cli.js analyze <repo-path> [options]`)*

### Command Options

| Option | Description | Default |
|---|---|---|
| `<repo-path>` | Path to the target local Git repository (e.g., `.`, `../other-repo`) | *Required* |
| `--author="Name"` | Filter history to commits whose author matches this substring (case-insensitive) | None |
| `--since="YYYY-MM-DD"` | Filter history to commits on or after this ISO date | None |
| `--export=json\|html\|both` | Generate exported report files (`report.json`, `index.html`) | None |
| `--out=DIR` | Target output directory for exported files | `.` |
| `--limit=N` | Maximum rows displayed in each terminal report table | `10` |

### Examples

**Analyze current repository:**
```bash
./cli.js analyze .
```

**Limit terminal output to top 5 rows:**
```bash
./cli.js analyze . --limit=5
```

**Filter commits by contributor and date:**
```bash
./cli.js analyze . --author="Mohit" --since="2026-01-01"
```

**Generate both JSON and HTML reports in a `./report` directory:**
```bash
./cli.js analyze . --export=both --out=./report
```

Open the generated HTML dashboard in your browser:
```bash
open ./report/index.html
```

---

## Metrics & Output Schema

The analytics engine produces a unified metrics payload structured into four components:

### 1. Repository Summary (`summary`)
High-level KPIs summarizing repository velocity and risk posture.

```json
{
  "totalCommits": 47,
  "uniqueFiles": 28,
  "totalContributors": 3,
  "busFactorRiskCount": 5,
  "topHotspot": "src/auth/login.js"
}
```

### 2. Code Churn / Hotspots (`churn`)
Identifies files modified across the highest number of distinct commits, along with cumulative line turnover.
- **Safeguard Handling**: Automatically ignores commits with missing or empty file diff arrays.
- **Ranking**: Sorted in descending order by commit frequency.

```json
{
  "name": "src/auth/login.js",
  "frequency": 12,
  "insertions": 340,
  "deletions": 85
}
```

### 3. Temporal Coupling (`coupling`)
Detects implicit architectural dependencies by finding pairs of files frequently modified together within the same commit.
- **Noise Safeguard**: Skips commits modifying more than 30 files to exclude bulk formatting passes and dependency updates.
- **Significance Filter**: Filters out file pairs with fewer than 2 co-occurrences (`count < 2`).
- **Directional Coupling**: Calculates independent percentages (`percentage_file1`, `percentage_file2`) indicating how often modifying File A required modifying File B.
- **Ranking**: Sorted by co-change count descending, with ties broken by `percentage_file1`.

```json
{
  "file1": "src/auth/login.js",
  "file2": "src/utils/api.js",
  "count": 8,
  "percentage_file1": 80,
  "percentage_file2": 100
}
```

### 4. Code Ownership & Bus Factor (`ownership`)
Identifies knowledge silos by calculating which contributor owns the majority of changes in each file.
- **Author Normalization**: Normalizes whitespace and maps missing authors to `"Unknown"`.
- **Weighted Share**: Share is computed from total `linesChanged` (`insertions + deletions`), falling back to commit counts for empty/mode-only files.
- **Risk Threshold**: Files where a single author accounts for >= 80% ownership are flagged with `isBusFactorRisk: true`.
- **Ranking**: Sorted by `ownershipPercentage` descending, broken by `totalLinesChanged`.

```json
{
  "file": "src/auth/login.js",
  "primaryOwner": "Mohit",
  "ownershipPercentage": 90,
  "isBusFactorRisk": true,
  "totalLinesChanged": 425,
  "contributors": {
    "Mohit": { "commits": 6, "linesChanged": 425 },
    "Alex": { "commits": 1, "linesChanged": 45 }
  }
}
```

---

## Offline Test Suite

Strata includes an end-to-end integration test suite that generates a synthetic Git repository with ground-truth commit history to verify argument handling, filters, metric accuracy, escaping, and exports:

```bash
bash run-tests.sh
```

Expected output:
```
RESULT: 23 passed, 0 failed
```
