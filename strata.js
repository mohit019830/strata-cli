// strata.js - CLI tool to analyze Git repository health
// Part A: The Data Extraction Layer

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");


function getCommitHistory(repoPath) {
    /**
     * Takes the path to a git repo and returns an array of commits.
     * Each commit will have: hash, author, timestamp, message, and files changed.
     */

    // Step 1: just returning an empty array for now
    // we'll build this out step by step
    let commits = [];

    return commits;
}


// --- quick test ---
const testPath = ".";
const result = getCommitHistory(testPath);
console.log(result);
