-- ============================================================================
-- Strata Git Analytics Engine - Database Schema (SQLite)
-- DBMS Major Project | Subject Code: DE (2501010309)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Authors Table (1:N with Commits)
CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    email TEXT
);

-- 2. Commits Table
CREATE TABLE IF NOT EXISTS commits (
    hash TEXT PRIMARY KEY,
    author_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    message TEXT NOT NULL,
    files_count INTEGER DEFAULT 0 CHECK (files_count >= 0),
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE RESTRICT
);

-- 3. Files Table
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE
);

-- 4. Commit_Files Junction Table (Resolves M:N between Commits and Files)
CREATE TABLE IF NOT EXISTS commit_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commit_hash TEXT NOT NULL,
    file_id INTEGER NOT NULL,
    insertions INTEGER NOT NULL DEFAULT 0 CHECK (insertions >= 0),
    deletions INTEGER NOT NULL DEFAULT 0 CHECK (deletions >= 0),
    FOREIGN KEY (commit_hash) REFERENCES commits(hash) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE (commit_hash, file_id)
);

-- ============================================================================
-- Performance Indexes (Optimizing Analytical Queries)
-- ============================================================================

-- Supports filtering and author aggregation (Bus Factor / Code Ownership)
CREATE INDEX IF NOT EXISTS idx_commits_author ON commits(author_id);
CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp);

-- Supports fast grouping for Churn (Hotspots) and self-joins for Temporal Coupling
CREATE INDEX IF NOT EXISTS idx_commit_files_composite ON commit_files(commit_hash, file_id);
CREATE INDEX IF NOT EXISTS idx_commit_files_file_id ON commit_files(file_id);

