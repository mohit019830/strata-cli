// server.js - Lightweight static server for Strata visual dashboard
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const REPORT_DIR = path.join(__dirname, "report");

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  let filePath = path.join(REPORT_DIR, reqPath === "/" ? "index.html" : reqPath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    } else {
      const ext = path.extname(filePath);
      let contentType = "text/html";
      if (ext === ".js") contentType = "application/javascript";
      else if (ext === ".json") contentType = "application/json";
      else if (ext === ".css") contentType = "text/css";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Strata Dashboard running at http://localhost:${PORT}/`);
});

