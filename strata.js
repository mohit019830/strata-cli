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

    let commits = [];

    // Step 2: check if the given path is actually a git repo
    // running "git status" is the simplest way - if it fails, it's not a repo
    const statusOutput = execSync("git status", {
        cwd: repoPath,
        encoding: "utf-8"
    });

    console.log(`Valid git repo found at: ${repoPath}`);

    return commits;
}


// --- quick test ---
const testPath = ".";
const result = getCommitHistory(testPath);
console.log(result);
