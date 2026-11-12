// analyzer.js - Analytics Engine for Strata ("The Brain")
const fs = require("fs");
const path = require("path");

const MAX_FILES_FOR_COUPLING = 30;

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

    if (commit.files.length > MAX_FILES_FOR_COUPLING) {
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
  }

  for (const pair of Object.values(coupling)) {
    const freq1 = churn[pair.file1].frequency;
    const freq2 = churn[pair.file2].frequency;

    pair.percentage_file1 = Math.round((pair.count / freq1) * 100);
    pair.percentage_file2 = Math.round((pair.count / freq2) * 100);
  }

  const sortedChurn = Object.entries(churn).map(([name, stats]) => ({
    name,
    frequency: stats.frequency,
    insertions: stats.insertions,
    deletions: stats.deletions
  }));

  sortedChurn.sort((a, b) => b.frequency - a.frequency);

  const sortedCoupling = Object.values(coupling)
    .filter(pair => pair.count >= 2)
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.percentage_file1 - a.percentage_file1;
    });

  return {
    churn: sortedChurn,
    coupling: sortedCoupling
  };
}

const dataPath = path.join(__dirname, "mockData.json");
const rawData = fs.readFileSync(dataPath, "utf-8");
const commits = JSON.parse(rawData);

const results = analyzeRepository(commits);
console.log("Analysis Results:", results);

module.exports = { analyzeRepository, generateFilePairs };
