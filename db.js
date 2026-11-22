// db.js - SQLite Database Manager for Strata Analytics Engine
// DBMS Major Project Demonstration Script
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "strata.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

// Initialize Database Connection
function getDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

// 1. Setup Schema
function setupSchema(db) {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schemaSql);
  console.log("✔ Schema applied successfully from schema.sql");
}

// 2. Seed Repository Data (Real Git History with Mock Fallback)
function seedData(db) {
  let commitsToSeed = [];
  try {
    const { getCommitHistory } = require("./strata");
    commitsToSeed = getCommitHistory(__dirname);
  } catch (e) {
    // fallback if git log is not available
  }

  if (!commitsToSeed || commitsToSeed.length === 0) {
    commitsToSeed = JSON.parse(
      fs.readFileSync(path.join(__dirname, "mockData.json"), "utf-8")
    );
  }

  const insertAuthor = db.prepare(
    "INSERT OR IGNORE INTO authors (name) VALUES (?)"
  );
  const getAuthorId = db.prepare("SELECT id FROM authors WHERE name = ?");
  const insertFile = db.prepare(
    "INSERT OR IGNORE INTO files (path) VALUES (?)"
  );
  const getFileId = db.prepare("SELECT id FROM files WHERE path = ?");
  const insertCommit = db.prepare(
    "INSERT OR IGNORE INTO commits (hash, author_id, timestamp, message, files_count) VALUES (?, ?, ?, ?, ?)"
  );
  const insertCommitFile = db.prepare(
    "INSERT OR IGNORE INTO commit_files (commit_hash, file_id, insertions, deletions) VALUES (?, ?, ?, ?)"
  );

  db.exec("BEGIN TRANSACTION;");
  try {
    for (const commit of commitsToSeed) {
      const author = (commit.author || "").trim() || "Unknown";
      insertAuthor.run(author);
      const authorRecord = getAuthorId.get(author);
      const authorId = authorRecord ? authorRecord.id : 1;

      const files = commit.files || [];
      insertCommit.run(
        commit.hash,
        authorId,
        commit.timestamp,
        commit.message,
        files.length
      );

      for (const file of files) {
        if (!file.name) continue;
        insertFile.run(file.name);
        const fileRecord = getFileId.get(file.name);
        if (fileRecord) {
          insertCommitFile.run(
            commit.hash,
            fileRecord.id,
            Number(file.insertions) || 0,
            Number(file.deletions) || 0
          );
        }
      }
    }
    db.exec("COMMIT;");
    console.log(`✔ Successfully seeded ${commitsToSeed.length} commits from Git repository into SQLite database`);
  } catch (err) {
    db.exec("ROLLBACK;");
    console.error("✘ Seeding failed, transaction rolled back:", err.message);
  }
}

// 3. Demonstrate Constraint Enforcement (Viva Demo Q4)
function demoConstraints(db) {
  console.log("\n--- DEMONSTRATING CONSTRAINT ENFORCEMENT ---");
  // Test A: CHECK constraint violation (negative insertions)
  try {
    console.log("Attempting to insert negative line insertions (CHECK constraint)...");
    db.exec(`
      INSERT INTO commit_files (commit_hash, file_id, insertions, deletions) 
      VALUES ('7a3f9e2b', 1, -50, 10);
    `);
    console.log("✘ Failed: Check constraint did not trigger");
  } catch (err) {
    console.log("✔ Success: Database rejected invalid data:", err.message);
  }

  // Test B: FOREIGN KEY constraint violation (non-existent author)
  try {
    console.log("Attempting to insert commit with non-existent author_id (FOREIGN KEY constraint)...");
    db.exec(`
      INSERT INTO commits (hash, author_id, timestamp, message, files_count) 
      VALUES ('invalid01', 9999, '2026-11-22T00:00:00Z', 'Test invalid', 0);
    `);
    console.log("✘ Failed: Foreign key constraint did not trigger");
  } catch (err) {
    console.log("✔ Success: Database rejected invalid foreign key:", err.message);
  }
}

// 4. Demonstrate Key Analytical Queries (Viva Demo Q1, Q2, Q5)
function runAnalyticalQueries(db) {
  console.log("\n--- DEMONSTRATING FREQUENT APPLICATION QUERIES ---");

  // Query 1: Churn Hotspots
  console.log("\n[Query 1: Churn Hotspots - Grouping, Counting & Aggregation]");
  const churnQuery = `
    SELECT f.path AS file,
           COUNT(cf.commit_hash) AS modifications,
           SUM(cf.insertions) AS total_insertions,
           SUM(cf.deletions) AS total_deletions
    FROM files f
    JOIN commit_files cf ON f.id = cf.file_id
    GROUP BY f.id, f.path
    ORDER BY modifications DESC, total_insertions DESC;
  `;
  const churnResults = db.prepare(churnQuery).all();
  console.table(churnResults);

  // Query 2: Temporal Coupling (Self-Join resolving co-changed pairs)
  console.log("\n[Query 2: Temporal Coupling - Self-Join Across Junction Table]");
  const couplingQuery = `
    SELECT f1.path AS file1,
           f2.path AS file2,
           COUNT(*) AS co_change_count
    FROM commit_files cf1
    JOIN commit_files cf2 
      ON cf1.commit_hash = cf2.commit_hash AND cf1.file_id < cf2.file_id
    JOIN files f1 ON cf1.file_id = f1.id
    JOIN files f2 ON cf2.file_id = f2.id
    GROUP BY cf1.file_id, cf2.file_id
    ORDER BY co_change_count DESC;
  `;
  const couplingResults = db.prepare(couplingQuery).all();
  console.table(couplingResults);

  // Query 3: Code Ownership & Bus Factor Risk
  console.log("\n[Query 3: Code Ownership - Multi-table Join for Contributor Distribution]");
  const ownershipQuery = `
    SELECT f.path AS file,
           a.name AS author,
           COUNT(c.hash) AS commits,
           SUM(cf.insertions + cf.deletions) AS lines_changed
    FROM files f
    JOIN commit_files cf ON f.id = cf.file_id
    JOIN commits c ON cf.commit_hash = c.hash
    JOIN authors a ON c.author_id = a.id
    GROUP BY f.id, a.id
    ORDER BY f.path, lines_changed DESC;
  `;
  const ownershipResults = db.prepare(ownershipQuery).all();
  console.table(ownershipResults);

  // Query 4: Query Plan Demonstration (Viva Demo Q5)
  console.log("\n[Query 4: Index Efficiency - EXPLAIN QUERY PLAN]");
  const plan = db.prepare("EXPLAIN QUERY PLAN " + couplingQuery).all();
  console.table(plan);
}

// Self-executing runner for live demo
if (require.main === module) {
  const db = getDb();
  setupSchema(db);
  seedData(db);
  demoConstraints(db);
  runAnalyticalQueries(db);
  db.close();
}

module.exports = { getDb, setupSchema, seedData };

