// analyzer.js - Analytics Engine for Strata ("The Brain")
const fs = require("fs");
const path = require("path");

function generateFilePairs(files) {
  if (!files || files.length < 2) {
    return [];
  }

  const pairs = [];

  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const fileA = files[i].name;
      const fileB = files[j].name;
      const pair = fileA < fileB ? [fileA, fileB] : [fileB, fileA];
      pairs.push(pair);
    }
  }

  return pairs;
}

function analyzeRepository(commits) {
  const churn = {};
  const coupling = {};

  for (const commit of commits) {
    if (!commit.files || commit.files.length === 0) {
      continue;
    }

    const pairs = generateFilePairs(commit.files);
    for (const pair of pairs) {
      const key = `${pair[0]}::${pair[1]}`;
      if (!coupling[key]) {
        coupling[key] = {
          file1: pair[0],
          file2: pair[1],
          count: 1
        };
      } else {
        coupling[key].count += 1;
      }
    }

    for (const file of commit.files) {
      if (!churn[file.name]) {
        churn[file.name] = {
          frequency: 1,
          insertions: file.insertions,
          deletions: file.deletions
        };
      } else {
        churn[file.name].frequency += 1;
        churn[file.name].insertions += file.insertions;
        churn[file.name].deletions += file.deletions;
      }
    }
  }

  const sortedChurn = Object.entries(churn).map(([name, stats]) => ({
    name,
    frequency: stats.frequency,
    insertions: stats.insertions,
    deletions: stats.deletions
  }));

  sortedChurn.sort((a, b) => b.frequency - a.frequency);

  return {
    churn: sortedChurn,
    coupling
  };
}

const dataPath = path.join(__dirname, "mockData.json");
const rawData = fs.readFileSync(dataPath, "utf-8");
const commits = JSON.parse(rawData);

const results = analyzeRepository(commits);
console.log("Analysis Results:", results);

module.exports = { analyzeRepository, generateFilePairs };
