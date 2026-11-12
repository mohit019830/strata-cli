// analyzer.js - Analytics Engine for Strata ("The Brain")
const fs = require("fs");
const path = require("path");

function analyzeRepository(commits) {
  const churn = {};

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!churn[file.name]) {
        churn[file.name] = 1;
      } else {
        churn[file.name]++;
      }
    }
  }

  return {
    churn
  };
}

const dataPath = path.join(__dirname, "mockData.json");
const rawData = fs.readFileSync(dataPath, "utf-8");
const commits = JSON.parse(rawData);

const results = analyzeRepository(commits);
console.log("Analysis Results:", results);

module.exports = { analyzeRepository };
