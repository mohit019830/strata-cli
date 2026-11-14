// terminal-ui.js - colored terminal output for Strata
// Part C: The Presentation Layer
//
// Takes the analytics object from analyzer.js and prints a report with
// clear visual hierarchy: a summary block with a health verdict, then
// one section per analysis with an ASCII table and inline bar charts
// so the biggest problems stand out at a glance.

const chalk = require("chalk");
const Table = require("cli-table3");

const BAR_WIDTH = 18;

// Inline bar, e.g. ████████░░░░░░ scaled to the largest value in the table.
// Gives instant hierarchy without leaving the terminal.
function bar(value, max, color) {
  const filled = max > 0 ? Math.max(1, Math.round((value / max) * BAR_WIDTH)) : 0;
  return color("█".repeat(filled)) + chalk.gray("░".repeat(BAR_WIDTH - filled));
}

function rule() {
  console.log(chalk.gray("  " + "─".repeat(64)));
}

function sectionTitle(index, title, hint) {
  console.log("");
  rule();
  console.log("  " + chalk.bold.cyan(`${index}. ${title}`) + (hint ? chalk.gray("  " + hint) : ""));
  rule();
}

function renderSummary(summary, filters = {}) {
  console.log("");
  console.log("  " + chalk.bold.cyan("STRATA") + chalk.gray(" · repository health report"));
  rule();
  if (filters.author || filters.since) {
    const parts = [];
    if (filters.author) parts.push(`author \"${filters.author}\"`);
    if (filters.since) parts.push(`since ${filters.since}`);
    console.log(chalk.yellow(`  Scoped to filtered commits (${parts.join(", ")}) - ownership and bus-factor figures cover only that subset.`));
  }
  const risk = summary.busFactorRiskCount;
  const riskText = risk > 0 ? chalk.red.bold(risk) : chalk.green.bold(risk);
  const rows = [
    ["Commits:", chalk.bold(summary.totalCommits)],
    ["Files touched:", chalk.bold(summary.uniqueFiles)],
    ["Contributors:", chalk.bold(summary.totalContributors)],
    ["Bus-factor risks:", riskText]
  ];
  for (const [label, value] of rows) {
    console.log(`  ${chalk.gray(label.padEnd(18))} ${value}`);
  }
  if (summary.topHotspot) {
    console.log(`  ${chalk.gray("Hottest file:".padEnd(18))} ${chalk.yellow(summary.topHotspot)}`);
  }
  console.log("");
  if (risk > 0) {
    console.log("  " + chalk.bgRed.white.bold(" NEEDS ATTENTION ") +
      chalk.red(` ${risk} file${risk === 1 ? "" : "s"} where one author makes 80%+ of the changes.`));
  } else {
    console.log("  " + chalk.bgGreen.black.bold(" LOOKS HEALTHY ") +
      chalk.green(" no single-owner knowledge silos detected."));
  }
}

function renderChurn(churn, limit) {
  sectionTitle(1, "CHURN HOTSPOTS", "files changed in the most commits");
  const visible = churn.slice(0, limit);
  const max = visible.reduce((m, r) => Math.max(m, r.frequency), 0);
  const table = new Table({
    head: [chalk.bold("File"), chalk.bold("Changes"), chalk.bold("Chart"), chalk.bold("+ Lines"), chalk.bold("- Lines")],
    colAligns: ["left", "right", "left", "right", "right"],
    style: { head: [] }
  });
  for (const row of visible) {
    table.push([
      row.name,
      row.frequency,
      bar(row.frequency, max, chalk.blue),
      chalk.green("+" + row.insertions),
      chalk.red("-" + row.deletions)
    ]);
  }
  console.log(table.toString());
  if (churn.length > limit) {
    console.log(chalk.gray(`  ... ${churn.length - limit} more files (use --limit to show more)`));
  }
}

function renderCoupling(coupling, limit) {
  sectionTitle(2, "TEMPORAL COUPLING", "files that change together");
  if (coupling.length === 0) {
    console.log(chalk.gray("  No recurring file pairs found."));
    return;
  }
  console.log(chalk.gray("  \"A -> B 80%\" means 80% of the commits touching A also touched B."));
  const table = new Table({
    head: [chalk.bold("File A"), chalk.bold("File B"), chalk.bold("Together"), chalk.bold("A -> B"), chalk.bold("B -> A")],
    colAligns: ["left", "left", "right", "right", "right"],
    style: { head: [] }
  });
  for (const pair of coupling.slice(0, limit)) {
    table.push([
      pair.file1,
      pair.file2,
      pair.count + "x",
      pair.percentage_file1 + "%",
      pair.percentage_file2 + "%"
    ]);
  }
  console.log(table.toString());
}

function renderOwnership(ownership, limit) {
  sectionTitle(3, "KNOWLEDGE SILOS", "bus-factor risk highlighted");
  const table = new Table({
    head: [chalk.bold("File"), chalk.bold("Main owner"), chalk.bold("Ownership"), chalk.bold("Chart"), chalk.bold("Risk")],
    colAligns: ["left", "left", "right", "left", "left"],
    style: { head: [] }
  });
  for (const row of ownership.slice(0, limit)) {
    const pct = row.ownershipPercentage + "%";
    table.push([
      row.file,
      row.primaryOwner,
      row.isBusFactorRisk ? chalk.red.bold(pct) : pct,
      bar(row.ownershipPercentage, 100, row.isBusFactorRisk ? chalk.red : chalk.blue),
      row.isBusFactorRisk ? chalk.red.bold("HIGH") : chalk.green("ok")
    ]);
  }
  console.log(table.toString());
}

function renderReport(results, { limit = 10, filters = {} } = {}) {
  renderSummary(results.summary, filters);
  renderChurn(results.churn, limit);
  renderCoupling(results.coupling, limit);
  renderOwnership(results.ownership, limit);
  console.log("");
  console.log(chalk.gray('  Tip: add --export=both --out=report to save report.json and an offline index.html with graphs.'));
  console.log("");
}

module.exports = { renderReport };
