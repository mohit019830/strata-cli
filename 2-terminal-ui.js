// terminal-ui.js - colored terminal output for Strata
// Part C: The Presentation Layer
//
// Takes the analytics object from analyzer.js and prints:
//   - a summary line
//   - an ASCII table of churn hotspots
//   - an ASCII table of temporal coupling pairs
//   - an ASCII table of ownership / bus-factor risks

const chalk = require("chalk");
const Table = require("cli-table3");

function renderSummary(summary, filters = {}) {
  console.log("");
  console.log(chalk.bold.underline("Repository summary"));
  if (filters.author || filters.since) {
    const parts = [];
    if (filters.author) parts.push(`author \"${filters.author}\"`);
    if (filters.since) parts.push(`since ${filters.since}`);
    console.log(chalk.yellow(`  Scoped to filtered commits (${parts.join(", ")}) - ownership and bus-factor figures cover only that subset.`));
  }
  console.log(`  Commits:      ${chalk.bold(summary.totalCommits)}`);
  console.log(`  Files touched: ${chalk.bold(summary.uniqueFiles)}`);
  console.log(`  Contributors:  ${chalk.bold(summary.totalContributors)}`);
  const risk = summary.busFactorRiskCount;
  const riskText = risk > 0 ? chalk.red.bold(risk) : chalk.green(risk);
  console.log(`  Bus-factor risks: ${riskText}`);
  if (summary.topHotspot) {
    console.log(`  Hottest file:  ${chalk.yellow(summary.topHotspot)}`);
  }
}

function renderChurn(churn, limit) {
  console.log("");
  console.log(chalk.bold.underline("Churn hotspots") + chalk.gray(" (files rewritten the most)"));
  const table = new Table({
    head: [chalk.bold("File"), chalk.bold("Changes"), chalk.bold("+ Lines"), chalk.bold("- Lines")],
    style: { head: [] }
  });
  for (const row of churn.slice(0, limit)) {
    table.push([row.name, row.frequency, chalk.green("+" + row.insertions), chalk.red("-" + row.deletions)]);
  }
  console.log(table.toString());
  if (churn.length > limit) {
    console.log(chalk.gray(`  ... ${churn.length - limit} more files (use --limit to show more)`));
  }
}

function renderCoupling(coupling, limit) {
  console.log("");
  console.log(chalk.bold.underline("Temporal coupling") + chalk.gray(" (files that change together)"));
  if (coupling.length === 0) {
    console.log(chalk.gray("  No recurring file pairs found."));
    return;
  }
  const table = new Table({
    head: [chalk.bold("File A"), chalk.bold("File B"), chalk.bold("Together"), chalk.bold("A -> B"), chalk.bold("B -> A")],
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
  console.log("");
  console.log(chalk.bold.underline("Knowledge silos") + chalk.gray(" (bus-factor risk highlighted)"));
  const table = new Table({
    head: [chalk.bold("File"), chalk.bold("Main owner"), chalk.bold("Ownership"), chalk.bold("Risk")],
    style: { head: [] }
  });
  for (const row of ownership.slice(0, limit)) {
    const pct = row.ownershipPercentage + "%";
    table.push([
      row.file,
      row.primaryOwner,
      row.isBusFactorRisk ? chalk.red.bold(pct) : pct,
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
}

module.exports = { renderReport };
