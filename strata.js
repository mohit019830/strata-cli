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

    // Step 3: handle bad paths and non-git folders with proper checks
    // first make sure the path even exists before running any git command
    if (!fs.existsSync(repoPath)) {
        console.log(`Error: the path '${repoPath}' does not exist.`);
        return commits;
    }

    try {
        // Step 2: check if the given path is actually a git repo
        // running "git status" is the simplest way - if it fails, it's not a repo
        const statusOutput = execSync("git status", {
            cwd: repoPath,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"]  // suppress error output from git
        });

        console.log(`Valid git repo found at: ${repoPath}`);

        // Step 5: use a custom --pretty=format with a delimiter
        // %h = short hash, %an = author name, %aI = ISO timestamp, %s = commit message
        // using "|||" as a separator so we can split easily later
        // (commas or pipes alone could appear in commit messages, so ||| is safer)
        const rawLog = execSync(
            'git log --pretty=format:"%h|||%an|||%aI|||%s"',
            {
                cwd: repoPath,
                encoding: "utf-8"
            }
        );

        console.log("--- Formatted git log output ---");
        console.log(rawLog);

    } catch (error) {
        // execSync throws if the command fails (non-zero exit code)
        // that means it's not a git repo, or git isn't installed
        console.log(`Error: '${repoPath}' is not a valid git repository.`);
        return commits;
    }

    return commits;
}


// --- quick test ---
const testPath = ".";
const result = getCommitHistory(testPath);
console.log(result);

module.exports = { getCommitHistory };
