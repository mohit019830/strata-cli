// exporter.js - file exports for Strata
// Part C: The Presentation Layer
//
// exportJson: dumps the analytics object to a clean report.json
// exportHtml: injects the data into template.html (mustache) so the
//             report can be viewed as graphs in a browser. Chart.js is
//             inlined from vendor/chart.umd.min.js, so index.html works
//             offline with no CDN or internet connection.

const fs = require("fs");
const path = require("path");
const Mustache = require("mustache");

const HTML_ROW_LIMIT = 15; // keep the browser report readable

function ensureOutDir(outDir) {
  const abs = path.resolve(outDir);
  // Create each path component one at a time instead of recursive mkdir.
  // Node's recursive mkdir can hang indefinitely on EPERM filesystems
  // (e.g. /proc); a plain mkdir per component fails fast with a clear error.
  const parts = abs.split(path.sep);
  let cur = parts[0] === "" ? path.sep : parts[0];
  for (let i = 1; i < parts.length; i++) {
    cur = path.join(cur, parts[i]);
    try {
      fs.mkdirSync(cur);
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }
  }
  return abs;
}

function exportJson(results, outDir) {
  const dir = ensureOutDir(outDir);
  const file = path.join(dir, "report.json");
  fs.writeFileSync(file, JSON.stringify(results, null, 2), "utf-8");
  return file;
}

function exportHtml(results, outDir, meta = {}) {
  const dir = ensureOutDir(outDir);
  const template = fs.readFileSync(path.join(__dirname, "template.html"), "utf-8");
  const chartJs = fs.readFileSync(path.join(__dirname, "vendor", "chart.umd.min.js"), "utf-8");

  // Mustache view: scalar fields for the header plus pre-trimmed arrays
  // for the tables. Mustache HTML-escapes every {{value}}, so file names
  // and authors containing <, >, & or quotes render as inert text.
  const view = {
    repoPath: meta.repoPath || "",
    author: meta.author,
    since: meta.since,
    hasFilters: Boolean(meta.author || meta.since),
    generatedAt: new Date().toISOString(),
    summary: results.summary,
    churnRows: results.churn.slice(0, HTML_ROW_LIMIT),
    couplingRows: results.coupling.slice(0, HTML_ROW_LIMIT),
    ownershipRows: results.ownership.slice(0, HTML_ROW_LIMIT).map(r => ({
      ...r,
      riskLabel: r.isBusFactorRisk ? "HIGH" : "ok",
      rowClass: r.isBusFactorRisk ? "risk" : ""
    }))
  };

  let html = Mustache.render(template, view);

  // Chart data goes into a <script> block as JSON. JSON.stringify does NOT
  // escape "</script>", so a file named `x</script><script>...` would break
  // out of the script block. Escaping every "<" as its unicode escape
  // keeps the JSON identical when parsed but makes the markup safe.
  const chartData = {
    churn: {
      labels: results.churn.slice(0, HTML_ROW_LIMIT).map(r => r.name),
      frequency: results.churn.slice(0, HTML_ROW_LIMIT).map(r => r.frequency),
      insertions: results.churn.slice(0, HTML_ROW_LIMIT).map(r => r.insertions),
      deletions: results.churn.slice(0, HTML_ROW_LIMIT).map(r => r.deletions)
    },
    ownership: {
      labels: results.ownership.slice(0, HTML_ROW_LIMIT).map(r => r.file),
      percentage: results.ownership.slice(0, HTML_ROW_LIMIT).map(r => r.ownershipPercentage)
    }
  };
  const safeJson = JSON.stringify(chartData).replace(/</g, "\\u003c");
  html = html.replace("__CHART_DATA__", safeJson);

  // Inline Chart.js so the report works offline. The vendored build is
  // checked to contain no "</script>" sequence.
  if (chartJs.includes("</script")) {
    throw new Error("vendored chart.umd.min.js is not safe to inline");
  }
  html = html.replace("__CHART_JS__", () => chartJs);

  const file = path.join(dir, "index.html");
  fs.writeFileSync(file, html, "utf-8");
  return file;
}

module.exports = { exportJson, exportHtml };
