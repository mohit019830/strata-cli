#!/usr/bin/env node
// cli.js - Strata command-line interface
// Part C: The Presentation Layer
//
// Usage:
//   strata analyze <repo-path> [--author="Name"] [--since="YYYY-MM-DD"]
//                  [--export=json|html|both] [--out=DIR] [--limit=N]

const path = require("path");
const chalk = require("chalk");
const cliProgress = require("cli-progress");

// Part C only works together with Part A (data extraction) and Part B
// (analytics). Those live on the team's parser/engine branches until the
// group merges, so fail with a clear explanation instead of a stack trace.
let getCommitHistory, analyzeRepository;
try {
  ({ getCommitHistory } = require("./strata"));     // Part A
  ({ analyzeRepository } = require("./analyzer"));  // Part B
} catch (err) {
  console.error(chalk.red("Cannot start: " + err.message));
  console.error(chalk.yellow(
    "strata.js (Part A) and analyzer.js (Part B) must sit in this folder.\n" +
    "Until the team merges, copy them from the parser and engine branches:\n" +
    "  git checkout parser -- strata.js\n" +
    "  git checkout engine -- analyzer.js"
  ));
  process.exit(1);
}

const { renderReport } = require("./terminal-ui");
const { exportJson, exportHtml } = require("./exporter");

const KNOWN_OPTIONS = new Set(["author", "since", "export", "out", "limit", "help"]);
const EXPORT_MODES = new Set(["json", "html", "both"]);

function fail(message) {
  console.error(chalk.red("Error: " + message));
  console.error(chalk.gray('Run "strata --help" to see valid usage.'));
  process.exit(1);
}

// --- tiny argument parser -------------------------------------------------
// Turns ["analyze", "./repo", "--author=Mahin", "--since=2025-01-01"]
// into { command: "analyze", repoPath: "./repo", options: { author: "Mahin", ... } }
// Unknown or malformed options are rejected with a clear message.
function parseArgs(argv) {
  const args = argv.slice(2); // drop "node" and "cli.js"
  const command = args[0];
  let repoPath = null;
  const options = { author: null, since: null, export: null, out: ".", limit: "10" };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const name = arg.slice(2, eq === -1 ? undefined : eq);
      if (!KNOWN_OPTIONS.has(name)) {
        fail(`unknown option "--${name}".`);
      }
      if (eq === -1) {
        if (name === "help") {
          options.help = true;
        } else {
          fail(`option "--${name}" needs a value, e.g. --${name}=...`);
        }
      } else {
        const value = arg.slice(eq + 1);
        if (value === "") {
          fail(`option "--${name}" has an empty value.`);
        }
        options[name] = value;
      }
    } else if (repoPath === null) {
      repoPath = arg; // first bare argument is the repo path
    } else {
      fail(`unexpected extra argument "${arg}". Put the repo path first.`);
    }
  }
  return { command, repoPath, options };
}

function validateOptions(options) {
  if (options.since) {
    const d = new Date(options.since);
    // new Date("2025-13-40") is Invalid Date; catch that here instead of
    // silently analyzing everything.
    if (isNaN(d.getTime())) {
      fail(`--since="${options.since}" is not a valid date. Use YYYY-MM-DD.`);
    }
  }
  if (options.export && !EXPORT_MODES.has(options.export)) {
    fail(`--export="${options.export}" is not valid. Use json, html or both.`);
  }
  const limit = Number(options.limit);
  if (!Number.isInteger(limit) || limit < 1) {
    fail(`--limit="${options.limit}" is not valid. Use a positive whole number.`);
  }
  options.limit = limit;
}

function printHelp() {
  console.log(chalk.bold("strata") + " - analyze the health of a Git repository");
  console.log("");
  console.log("Usage:");
  console.log("  strata analyze <repo-path> [options]");
  console.log("");
  console.log("Options:");
  console.log('  --author="Name"        only count commits by this author');
  console.log('  --since="YYYY-MM-DD"   only count commits on or after this date');
  console.log("  --export=json|html|both  also write report.json / index.html");
  console.log("  --out=DIR              folder for exported files (default: current)");
  console.log("  --limit=N              rows shown per terminal table (default: 10)");
}

// --- option -> commit filters ----------------------------------------------
function passesAuthorFilter(commit, author) {
  if (!author) return true;
  return (commit.author || "").toLowerCase().includes(author.toLowerCase());
}

function passesSinceFilter(commit, since) {
  if (!since) return true;
  // validity already checked in validateOptions
  return new Date(commit.timestamp) >= new Date(since);
}

function main() {
  const { command, repoPath, options } = parseArgs(process.argv);

  if (options.help) {
    printHelp();
    process.exit(0);
  }
  if (command !== "analyze" || !repoPath) {
    printHelp();
    process.exit(1);
  }
  validateOptions(options);

  const absPath = path.resolve(repoPath);

  // Stage 1: extract raw history (Part A). This is the slow step on big repos.
  console.log(chalk.cyan("Extracting commit history from ") + chalk.bold(absPath) + chalk.cyan(" ..."));
  const allCommits = getCommitHistory(absPath);
  if (allCommits.length === 0) {
    console.log(chalk.red("No commits found. Is this a valid git repository with at least one commit?"));
    process.exit(1);
  }
  console.log(chalk.green(`Found ${allCommits.length} commits.`));

  // Stage 2: apply --author / --since filters, with a real progress bar.
  const bar = new cliProgress.SingleBar(
    { format: "Filtering commits |" + chalk.cyan("{bar}") + "| {percentage}% ({value}/{total})" },
    cliProgress.Presets.shades_classic
  );
  bar.start(allCommits.length, 0);
  const filtered = [];
  for (const commit of allCommits) {
    if (passesAuthorFilter(commit, options.author) && passesSinceFilter(commit, options.since)) {
      filtered.push(commit);
    }
    bar.increment();
  }
  bar.stop();

  if (filtered.length === 0) {
    console.log(chalk.yellow("No commits match the given filters. Nothing to analyze."));
    process.exit(0);
  }
  if (filtered.length !== allCommits.length) {
    console.log(chalk.gray(`${filtered.length} of ${allCommits.length} commits kept after filtering.`));
  }

  // Stage 3: run the analytics engine (Part B).
  const results = analyzeRepository(filtered);

  // Stage 4: terminal report.
  renderReport(results, {
    limit: options.limit,
    filters: { author: options.author, since: options.since }
  });

  // Stage 5: optional exports. Write failures (bad folder, permissions,
  // disk full) get a readable message instead of a raw stack trace.
  const exportMode = options.export;
  try {
    if (exportMode === "json" || exportMode === "both") {
      const file = exportJson(results, options.out);
      console.log(chalk.green("JSON report written to " + file));
    }
    if (exportMode === "html" || exportMode === "both") {
      const file = exportHtml(results, options.out, {
        repoPath: absPath,
        author: options.author,
        since: options.since
      });
      console.log(chalk.green("HTML report written to " + file));
    }
  } catch (err) {
    fail(`could not write the export: ${err.message}`);
  }
}

main();
