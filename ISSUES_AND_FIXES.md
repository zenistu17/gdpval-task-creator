# GDPVal System - Comprehensive Issue Analysis & Fixes

**Analysis Date:** December 26, 2025
**Total Issues Found:** 70
**Repositories Analyzed:**
- `Parsewave-internal/admin` (branch: main)
- `Parsewave-internal/pipeline-experimenting` (branch: gdpval-main)

---

## Table of Contents

1. [Critical Issues (P0)](#critical-issues-p0) - 7 issues
2. [High Priority Bugs (P1)](#high-priority-bugs-p1) - 6 issues
3. [UX Issues](#ux-issues) - 13 issues
4. [Performance Issues](#performance-issues) - 5 issues
5. [Security Issues](#security-issues) - 7 issues
6. [Scaling Issues](#scaling-issues) - 4 issues
7. [Database Design Issues](#database-design-issues) - 4 issues
8. [Code Quality Issues](#code-quality-issues) - 6 issues
9. [Pipeline-Specific Issues](#pipeline-specific-issues) - 9 issues
10. [Documentation Issues](#documentation-issues) - 4 issues
11. [Testing & Observability](#testing--observability) - 3 issues
12. [Additional Improvements](#additional-improvements) - 8 issues
13. [Priority Roadmap](#priority-roadmap)

---

## Critical Issues (P0)

### Issue #1: Conflicting Prompts in Pipeline
**Severity:** Critical
**Location:**
- `pipeline-experimenting/pipelines/base_prompt.txt`
- `pipeline-experimenting/pipelines/gdpval/instructions.txt`
- `pipeline-experimenting/scripts/gdpval_build.py:121`

**Problem:**
The system combines TWO prompts with fundamentally conflicting instructions:

**base_prompt.txt says:**
```
TASK DESCRIPTION: Create unambiguous task description in task.yaml.
Only alter task description in task.yaml, do not alter any other fields.
```

**gdpval/instructions.txt says:**
```
YOUR JOB IS TO GENERATE ONLY:
1. tests/test_outputs.py
2. Dockerfile

DO NOT MODIFY: task.yaml, docker-compose.yaml, data/, solution_files/
```

**Impact:**
Claude receives mixed instructions causing confusion and incorrect outputs.

**Fix:**
```python
# Option 1: Quick fix in gdpval_build.py line 121
# FROM:
prompt_template = base_prompt + "\n\n" + domain_prompt

# TO:
prompt_template = domain_prompt  # GDPVal doesn't need base_prompt

# Option 2: Proper fix - create gdpval-specific base_prompt
# Create pipelines/gdpval/base_prompt.txt without task-creation instructions
```

---

### Issue #2: solution_files Mapping Not Explained in Prompt
**Severity:** Critical
**Location:** `pipeline-experimenting/pipelines/gdpval/instructions.txt`

**Problem:**
Prompt says "solution files are at tests/solution/" but doesn't explain:
- These files come from `solution_files` uploaded in frontend
- They're copied by mutator.py during setup
- solution.sh must reference them as `/tests/solution/` (container path)

**Impact:**
Claude doesn't understand file locations, generates broken solution.sh

**Fix:**
```markdown
Add to instructions.txt around line 25:

## Understanding Solution Files Location

The solution_files you see in the database are automatically copied to:
- **Build-time path:** tasks/{task_id}/tests/solution/
- **Container path:** /tests/solution/ (use this in solution.sh)

Your solution.sh should copy or process files FROM /tests/solution/ TO the expected output locations specified in task.yaml.

Example:
```bash
# Copy solution files to expected output locations
cp /tests/solution/output.csv /app/output.csv
# OR process them if needed
python /tests/solution/generate_output.py > /app/result.txt
```
```

---

### Issue #3: Race Condition in Task Creation
**Severity:** Critical
**Location:** `admin/routes/gdpvalTask.js:87-107`

**Problem:**
Task creation uses transaction for main insert but NOT for related inserts (rubrics, files, yaml, script).

**Current Code:**
```javascript
const task = await db.createGdpvalTaskWithTransaction({...});
// Later: separate inserts for rubrics, files (NOT in transaction)
```

**Impact:**
If creation fails mid-way, orphaned data in related tables.

**Fix:**
```javascript
// Extend transaction to include ALL inserts
const createGdpvalTaskWithTransaction = async (params) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert task
    const taskResult = await client.query('INSERT INTO gdpval_tasks...');
    const taskId = taskResult.rows[0].id;

    // Insert rubrics (in same transaction)
    for (const rubric of params.rubrics) {
      await client.query('INSERT INTO gdpval_rubrics...', [taskId, ...]);
    }

    // Insert files (in same transaction)
    for (const file of params.solution_files) {
      await client.query('INSERT INTO gdpval_solution_files...', [taskId, ...]);
    }

    // Insert yaml, script (in same transaction)
    await client.query('INSERT INTO gdpval_task_yaml...', [taskId, ...]);

    await client.query('COMMIT');
    return taskResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

---

### Issue #4: Server Status Race Condition
**Severity:** Critical
**Location:** `admin/db/index.js:2049-2063`

**Problem:**
`markGdpvalServerBusy()` doesn't check if server is actually available before marking it busy.

**Current Code:**
```javascript
UPDATE gdpval_servers
SET status = 'busy', current_task_id = $2
WHERE id = $1
```

**Impact:**
Two concurrent tasks could mark same server as busy, causing conflicts.

**Fix:**
```javascript
// Add WHERE clause to check current status
const markGdpvalServerBusy = async (serverId, taskId) => {
  const result = await pool.query(
    `UPDATE gdpval_servers
     SET status = 'busy', current_task_id = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'available'  -- Only update if available!
     RETURNING *`,
    [serverId, taskId]
  );

  if (result.rows.length === 0) {
    throw new Error('Server not available for assignment');
  }

  return result.rows[0];
};
```

---

### Issue #5: Memory Leak in activeMonitors Map
**Severity:** Critical
**Location:** `admin/services/gdpvalTaskService.js:20-22, 354-356`

**Problem:**
`activeMonitors` Map stores task monitoring intervals but if `stopTaskMonitor()` fails or isn't called, intervals keep running forever.

**Current Code:**
```javascript
const activeMonitors = new Map(); // Stores intervals
// If stopTaskMonitor() is never called, intervals leak!
```

**Impact:**
Server memory leak over time, especially if tasks fail unexpectedly.

**Fix:**
```javascript
// Add cleanup function (runs every 10 minutes)
const MAX_MONITOR_AGE = 60 * 60 * 1000; // 1 hour

function cleanupStaleMonitors() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [taskId, monitor] of activeMonitors.entries()) {
    const age = now - monitor.startTime;
    if (age > MAX_MONITOR_AGE) {
      console.log(`[GDPVal] Cleaning up stale monitor for task ${taskId}`);
      if (monitor.logInterval) clearInterval(monitor.logInterval);
      if (monitor.statusInterval) clearInterval(monitor.statusInterval);
      activeMonitors.delete(taskId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[GDPVal] Cleaned up ${cleanedCount} stale monitors`);
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupStaleMonitors, 10 * 60 * 1000);

// Also cleanup on server restart
async function initializeMonitoringSystem() {
  activeMonitors.clear(); // Clear all on restart
  console.log('[GDPVal] Monitoring system initialized');
}
```

---

### Issue #6: validate_model Configuration is Wrong
**Severity:** Critical
**Location:** `pipeline-experimenting/pipelines/gdpval/config.yaml:54-58`

**Problem:**
```yaml
- step: validate_model
  params:
    model: "oss"
    max_trials: 5
    max_successes: 0  # ← Requires ALL trials to FAIL!
```

**Impact:**
For GDPVal tasks (real-world, potentially solvable), requiring all trials to fail doesn't make sense.

**Fix:**
```yaml
# Option 1: Remove this step entirely (GDPVal tasks are meant to be challenging but solvable)
# Comment out or delete lines 54-58

# Option 2: Change to validate tasks ARE solvable
- step: validate_model
  params:
    model: "oss"
    max_trials: 5
    max_successes: 1  # At least 1 success = task is solvable but hard

# Option 3: Skip for LLM-judge tasks (add condition)
- step: validate_model
  params:
    model: "oss"
    max_trials: 5
    max_successes: 0
    skip_if: "uses_llm_judge"  # Add this field to task metadata
```

---

### Issue #7: No File Upload Virus Scanning
**Severity:** Critical (Security)
**Location:** `admin/routes/gdpvalTask.js:123-175`

**Problem:**
Files are stored directly as BYTEA without any malware/virus scanning.

**Impact:**
Security risk - malicious files could be uploaded and executed by workers.

**Fix:**
```javascript
const ClamScan = require('clamscan');

// Initialize ClamAV scanner
const clamscan = await new ClamScan().init({
  clamdscan: {
    host: 'localhost',
    port: 3310,
  },
});

// Add virus scanning middleware
async function scanFileForViruses(fileBuffer, filename) {
  const { isInfected, viruses } = await clamscan.scanBuffer(fileBuffer);

  if (isInfected) {
    throw new Error(`File ${filename} is infected: ${viruses.join(', ')}`);
  }

  return true;
}

// Use in file upload handler
const fileContent = Buffer.from(file.content, 'base64');
await scanFileForViruses(fileContent, file.filename);
```

---

## High Priority Bugs (P1)

### Issue #8: Template solution.sh is Misleading
**Severity:** High
**Location:** `pipeline-experimenting/tasks/gdpval-template/solution.sh`

**Problem:**
Template shows fizz-buzz example that CREATES code from scratch, but GDPVal tasks should COPY/PROCESS solution_files.

**Fix:**
```bash
# Replace template with GDPVal-appropriate example
#!/bin/bash
set -e

# This is an oracle script that produces expected outputs
# by copying or processing solution files

# Example 1: Direct copy (if solution files are the outputs)
cp /tests/solution/output.csv /app/output.csv
cp /tests/solution/results.json /app/results.json

# Example 2: Processing solution files (if transformation needed)
# python /tests/solution/generate_from_template.py > /app/output.txt

# Example 3: Multiple steps
# cat /tests/solution/part1.txt /tests/solution/part2.txt > /app/combined.txt

echo "Oracle execution complete"
```

---

### Issue #9: N+1 Query in Task Fetching
**Severity:** High (Performance)
**Location:** `admin/db/index.js:1341-1367`

**Problem:**
`getGdpvalTaskFull()` makes 5 separate queries per task:
1. Get rubrics
2. Get solution files
3. Get data files
4. Get yaml
5. Get script

**Impact:**
Fetching 20 tasks = 100+ database queries! Very slow.

**Fix:**
```javascript
// Use JOINs with JSON aggregation
const getGdpvalTaskFull = async (taskId) => {
  const result = await pool.query(`
    SELECT
      t.*,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', r.id,
          'criteria', r.criteria,
          'points', r.points
        )) FILTER (WHERE r.id IS NOT NULL),
        '[]'
      ) as rubrics,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', sf.id,
          'filename', sf.filename,
          'file_size', sf.file_size
        )) FILTER (WHERE sf.id IS NOT NULL),
        '[]'
      ) as solution_files,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', df.id,
          'filename', df.filename,
          'file_size', df.file_size
        )) FILTER (WHERE df.id IS NOT NULL),
        '[]'
      ) as data_files,
      ty.content as task_yaml_content,
      sh.content as solution_sh_content
    FROM gdpval_tasks t
    LEFT JOIN gdpval_rubrics r ON r.task_id = t.id
    LEFT JOIN gdpval_solution_files sf ON sf.task_id = t.id
    LEFT JOIN gdpval_data_files df ON df.task_id = t.id
    LEFT JOIN gdpval_task_yaml ty ON ty.task_id = t.id
    LEFT JOIN gdpval_solution_sh sh ON sh.task_id = t.id
    WHERE t.task_id = $1
    GROUP BY t.id, ty.content, sh.content
  `, [taskId]);

  return result.rows[0];
};
```

---

### Issue #10: No Connection Pooling Configuration
**Severity:** High
**Location:** `admin/db/index.js:7-10`

**Problem:**
```javascript
const pool = new Pool({
  // No max, idleTimeout, or connectionTimeout configured!
});
```

**Impact:**
Can exhaust database connections under load.

**Fix:**
```javascript
const pool = new Pool({
  max: 20,                      // Maximum 20 connections
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if can't get connection
  allowExitOnIdle: true,        // Allow process to exit when idle

  // Existing config
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

// Add pool error handler
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});
```

---

### Issue #11: Unbounded Log File Growth
**Severity:** High
**Location:** `admin/services/gdpvalTaskService.js:126-144`

**Problem:**
Log files `/tmp/gdpval-${taskId}.log` are never cleaned up or size-limited.

**Impact:**
Disk space exhaustion on worker servers.

**Fix:**
```javascript
// Add log cleanup after task completion
async function cleanupTaskLogs(taskId, server) {
  const logFile = `/tmp/gdpval-${taskId}.log`;
  const scriptFile = `/tmp/gdpval-${taskId}.sh`;
  const statusFile = `/tmp/gdpval-${taskId}.status`;

  try {
    // Archive logs to database before deleting
    const logContent = await sshExec(server, `cat ${logFile} 2>/dev/null || echo ""`);
    await db.addGdpvalTaskLog(taskId, logContent);

    // Delete remote files
    await sshExec(server, `rm -f ${logFile} ${scriptFile} ${statusFile}`);
    console.log(`[GDPVal] Cleaned up logs for task ${taskId}`);
  } catch (error) {
    console.error(`[GDPVal] Failed to cleanup logs for ${taskId}:`, error.message);
  }
}

// Call in cleanupTask function
async function cleanupTask(taskId, server, status, error, output) {
  // ... existing cleanup code ...

  await cleanupTaskLogs(taskId, server);
}
```

---

### Issue #12: Missing Database Indexes
**Severity:** High (Performance)
**Location:** `admin/db/index.js:305-308, 237`

**Problem:**
Missing indexes on frequently queried columns:
- `pr_url` (used in search)
- `priority` (used in filtering)
- `status + created_at` (used in queue ordering)

**Fix:**
```sql
-- Add these indexes to database migration
CREATE INDEX IF NOT EXISTS idx_gdpval_tasks_pr_url
  ON gdpval_tasks(pr_url) WHERE pr_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gdpval_tasks_priority
  ON gdpval_tasks(priority);

CREATE INDEX IF NOT EXISTS idx_gdpval_tasks_status_created
  ON gdpval_tasks(status, created_at DESC);

-- Partial index for pending tasks (most common query)
CREATE INDEX IF NOT EXISTS idx_gdpval_tasks_pending
  ON gdpval_tasks(created_at)
  WHERE status = 'pending';

-- Composite index for search queries
CREATE INDEX IF NOT EXISTS idx_gdpval_tasks_search
  ON gdpval_tasks(status, sector, occupation, created_at DESC);
```

---

### Issue #13: Base64 Decoding Without Validation
**Severity:** High
**Location:** `admin/routes/gdpvalTask.js:126, 145`

**Problem:**
```javascript
Buffer.from(file.content, 'base64')  // No validation if valid base64!
```

**Impact:**
Can crash with malformed input.

**Fix:**
```javascript
function isValidBase64(str) {
  // Check if string is valid base64
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

  if (!base64Regex.test(str)) {
    return false;
  }

  // Try to decode and re-encode to verify
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}

// Use in file upload handler
if (!isValidBase64(file.content)) {
  return res.status(400).json({
    success: false,
    error: `Invalid base64 content for file: ${file.filename}`
  });
}

const fileContent = Buffer.from(file.content, 'base64');
```

---

## UX Issues

### Issue #14: No Search Debouncing
**Severity:** Medium
**Location:** `admin/public/gdpval/queue-script.js:76-78`

**Problem:**
Search triggers re-render on every keystroke.

**Impact:**
Laggy UI when typing fast.

**Fix:**
```javascript
let searchTimeout;
const searchInput = document.getElementById('search-input');

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);

  // Show loading indicator
  searchInput.classList.add('searching');

  // Debounce for 300ms
  searchTimeout = setTimeout(() => {
    searchInput.classList.remove('searching');
    renderQueue();
  }, 300);
});
```

---

### Issue #15: Terminal Modal Refresh Too Aggressive
**Severity:** Medium
**Location:** `admin/public/gdpval/queue-script.js:597`

**Problem:**
Terminal modal refreshes every 3 seconds constantly.

**Impact:**
Excessive server load, distracting for users watching logs.

**Fix:**
```javascript
// Exponential backoff for terminal refresh
let terminalRefreshInterval = 3000; // Start at 3s
const MAX_REFRESH_INTERVAL = 30000;  // Cap at 30s

function refreshTerminal() {
  fetchTerminalOutput();

  // Increase interval gradually
  terminalRefreshInterval = Math.min(
    terminalRefreshInterval * 1.2,
    MAX_REFRESH_INTERVAL
  );

  terminalTimeout = setTimeout(refreshTerminal, terminalRefreshInterval);
}

// Reset to 3s when new content arrives
function onNewTerminalContent() {
  terminalRefreshInterval = 3000;
}
```

---

### Issue #16: No File Upload Progress
**Severity:** Medium
**Location:** `admin/public/gdpval/script.js:767-795`

**Problem:**
Large files show no upload progress.

**Impact:**
Users don't know if upload is stuck.

**Fix:**
```javascript
function uploadFileWithProgress(file, progressCallback) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        progressCallback(percentComplete);
      }
    };

    reader.onload = () => {
      const base64Content = btoa(
        new Uint8Array(reader.result)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      resolve(base64Content);
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Usage
const progressBar = document.createElement('div');
progressBar.className = 'upload-progress';
fileItem.appendChild(progressBar);

const content = await uploadFileWithProgress(file, (percent) => {
  progressBar.style.width = `${percent}%`;
});
```

---

### Issue #17: Missing Keyboard Shortcuts
**Severity:** Medium
**Location:** `admin/public/gdpval/script.js:213`

**Problem:**
`initializeKeyboardShortcuts()` is called but not defined anywhere!

**Fix:**
```javascript
function initializeKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+S or Cmd+S: Save draft
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveDraft();
      showToast('Draft saved');
    }

    // Escape: Close modals
    if (e.key === 'Escape') {
      closeAllModals();
    }

    // Ctrl+Enter: Submit form (if on task creation page)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const submitBtn = document.getElementById('submit-task-btn');
      if (submitBtn && !submitBtn.disabled) {
        submitBtn.click();
      }
    }
  });
}
```

---

### Issue #18: Pagination Without URL State
**Severity:** Medium
**Location:** `admin/public/gdpval/queue-script.js:293-321`

**Problem:**
Pagination state not reflected in URL.

**Impact:**
Can't bookmark or share specific pages.

**Fix:**
```javascript
function updateURLState() {
  const params = new URLSearchParams();
  params.set('page', currentPage);
  params.set('status', currentStatus);
  if (currentSearch) params.set('search', currentSearch);

  window.history.replaceState({}, '', `?${params.toString()}`);
}

function loadStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  currentPage = parseInt(params.get('page')) || 1;
  currentStatus = params.get('status') || 'all';
  currentSearch = params.get('search') || '';
}

// Call on page load
loadStateFromURL();

// Call after any state change
function changePage(page) {
  currentPage = page;
  updateURLState();
  renderQueue();
}
```

---

### Issue #19: No Empty State Call-to-Action
**Severity:** Low
**Location:** `admin/public/gdpval/queue-script.js:361`

**Problem:**
Empty states just show text, no "Create your first task" button.

**Fix:**
```javascript
function renderEmptyState(status) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <h3>No ${status} tasks</h3>
      <p>Get started by creating your first GDPVal task</p>
      <a href="/gdpval-task.html" class="btn btn-primary">
        Create Task
      </a>
    </div>
  `;
}
```

---

### Issue #20: Unclear Error Messages
**Severity:** Medium
**Location:** `admin/public/gdpval/script.js` (form submission)

**Problem:**
API errors show raw technical messages like "unique_violation".

**Fix:**
```javascript
const ERROR_MESSAGES = {
  'unique_violation': 'A task with this ID already exists. Please choose a different ID.',
  'foreign_key_violation': 'Invalid reference in task data.',
  'check_violation': 'Data validation failed. Please check your inputs.',
  'not_null_violation': 'Required field is missing.',
  'string_data_right_truncation': 'Input text is too long.',
};

function getUserFriendlyError(error) {
  // Extract PostgreSQL error code
  const match = error.match(/error: ([\w_]+)/);
  if (match) {
    const code = match[1];
    return ERROR_MESSAGES[code] || error;
  }
  return error;
}

// Use in error handler
catch (error) {
  const friendlyMessage = getUserFriendlyError(error.message);
  showError(friendlyMessage);
}
```

---

### Issue #21-26: Additional UX Issues

See detailed descriptions in original analysis for:
- #21: No visual feedback on draft save
- #22: No bulk task selection feedback
- #23: No task preview before submit
- #24: Missing context in error messages
- #25: No undo functionality
- #26: Form doesn't preserve state on error

---

## Performance Issues

### Issue #27: Full Table Scan for Stats
**Severity:** High
**Location:** `admin/db/index.js:1414-1423, 1629-1662`

**Problem:**
`getGdpvalTaskStats()` does full table scan with COUNT FILTER.

**Fix:**
```sql
-- Create materialized view for stats
CREATE MATERIALIZED VIEW gdpval_task_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) as total_count,
  NOW() as last_updated
FROM gdpval_tasks;

-- Refresh on task status changes (use trigger or cron job)
CREATE OR REPLACE FUNCTION refresh_task_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY gdpval_task_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_stats
AFTER INSERT OR UPDATE OR DELETE ON gdpval_tasks
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_task_stats();
```

---

### Issue #28: Sources Stored as TEXT, Parsed as JSON
**Severity:** Medium
**Location:** `admin/db/index.js:226, 1360, 1381`

**Problem:**
`sources` column is TEXT but `JSON.parse()`'d on every fetch.

**Fix:**
```sql
-- Migrate to JSONB
ALTER TABLE gdpval_tasks
  ALTER COLUMN sources TYPE JSONB USING sources::jsonb;

-- Add GIN index for JSON queries
CREATE INDEX idx_gdpval_tasks_sources
  ON gdpval_tasks USING GIN (sources);
```

---

### Issue #29: Duplicate Server Queries
**Severity:** Medium
**Location:** `admin/public/gdpval/queue-script.js:267-270`

**Problem:**
Frontend fetches servers AND tasks every 10 seconds.

**Fix:**
```javascript
let cachedServers = null;
let serversCacheTime = 0;
const SERVERS_CACHE_TTL = 60000; // 1 minute

async function fetchServers() {
  const now = Date.now();

  // Return cached if still fresh
  if (cachedServers && (now - serversCacheTime) < SERVERS_CACHE_TTL) {
    return cachedServers;
  }

  // Fetch fresh data
  const response = await fetch('/api/gdpval/servers');
  cachedServers = await response.json();
  serversCacheTime = now;

  return cachedServers;
}

// Invalidate cache when server status changes
function onServerStatusChange() {
  cachedServers = null;
}
```

---

### Issue #30: Inefficient Reordering
**Severity:** Medium
**Location:** `admin/db/index.js:1863-1892`

**Problem:**
Reordering swaps `created_at` timestamps (loses actual creation time!).

**Fix:**
```sql
-- Add explicit sort_order column
ALTER TABLE gdpval_tasks ADD COLUMN sort_order INTEGER;

-- Initialize with current order
UPDATE gdpval_tasks
SET sort_order = row_number
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_number
  FROM gdpval_tasks
) as numbered
WHERE gdpval_tasks.id = numbered.id;

-- Create index
CREATE INDEX idx_gdpval_tasks_sort_order ON gdpval_tasks(sort_order);

-- Update reorder function
const reorderGdpvalTasks = async (taskId1, taskId2) => {
  // Swap sort_order values instead of created_at
  await pool.query(`
    WITH order_swap AS (
      SELECT id, sort_order,
        LEAD(sort_order) OVER (ORDER BY sort_order) as next_order
      FROM gdpval_tasks
      WHERE id IN ($1, $2)
    )
    UPDATE gdpval_tasks t
    SET sort_order = os.next_order
    FROM order_swap os
    WHERE t.id = os.id
  `, [taskId1, taskId2]);
};
```

---

### Issue #31: No File Content Compression
**Severity:** Medium
**Location:** `admin/db/index.js:339, 361`

**Problem:**
Files stored as raw BYTEA without compression.

**Fix:**
```javascript
const zlib = require('zlib');

// Compress before storing
const fileContent = Buffer.from(file.content, 'base64');
const compressed = zlib.gzipSync(fileContent);

await pool.query(
  `INSERT INTO gdpval_solution_files (task_id, filename, file_content, file_size, is_compressed)
   VALUES ($1, $2, $3, $4, true)`,
  [taskId, filename, compressed, fileContent.length]
);

// Decompress when fetching
const file = await pool.query('SELECT * FROM gdpval_solution_files WHERE id = $1', [fileId]);
const content = file.rows[0].is_compressed
  ? zlib.gunzipSync(file.rows[0].file_content)
  : file.rows[0].file_content;
```

---

## Security Issues

### Issue #32: No CSRF Protection
**Severity:** Critical
**Location:** All POST endpoints

**Fix:**
```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Apply to all state-changing routes
app.post('/api/gdpval/tasks', csrfProtection, async (req, res) => {
  // ... handler
});

// Send CSRF token to frontend
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Include in frontend requests
const token = await fetch('/api/csrf-token').then(r => r.json());
fetch('/api/gdpval/tasks', {
  method: 'POST',
  headers: { 'CSRF-Token': token.csrfToken },
  body: JSON.stringify(data)
});
```

---

### Issue #33: No File Type Validation
**Severity:** High
**Location:** `admin/routes/gdpvalTask.js:123-175`

**Fix:**
```javascript
const fileType = require('file-type');

async function validateFileType(fileBuffer, allowedTypes) {
  const type = await fileType.fromBuffer(fileBuffer);

  if (!type) {
    throw new Error('Could not determine file type');
  }

  if (!allowedTypes.includes(type.mime)) {
    throw new Error(`File type ${type.mime} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  return type;
}

// Usage
const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg'
];

const fileContent = Buffer.from(file.content, 'base64');
await validateFileType(fileContent, ALLOWED_TYPES);
```

---

### Issue #34-38: Additional Security Issues

See detailed fixes for:
- #34: Missing input length limits
- #35: SSH key authentication not verified
- #36: No rate limiting
- #37: No API authentication for workers
- #38: Session hijacking vulnerability

---

## Scaling Issues

### Issue #39: Single-Server Processing Bottleneck
**Severity:** High
**Location:** `admin/services/gdpvalTaskService.js:95-98, 180-185`

**Problem:**
Only one task can run per server, no parallelization.

**Fix:**
```javascript
// Add concurrency limit per server
const SERVER_CONCURRENCY = 3; // Allow 3 concurrent tasks per server

const getAvailableServer = async () => {
  // Find server with < MAX concurrent tasks
  const result = await db.query(`
    SELECT s.*, COUNT(t.id) as active_tasks
    FROM gdpval_servers s
    LEFT JOIN gdpval_tasks t ON t.server_id = s.id AND t.status = 'processing'
    WHERE s.status = 'available'
    GROUP BY s.id
    HAVING COUNT(t.id) < $1
    ORDER BY COUNT(t.id) ASC
    LIMIT 1
  `, [SERVER_CONCURRENCY]);

  return result.rows[0];
};
```

---

### Issue #40: No Task Queue Depth Limit
**Severity:** Medium
**Location:** `admin/routes/gdpvalTask.js:29-192`

**Fix:**
```javascript
// Check queue depth before accepting new task
const MAX_PENDING_TASKS = 1000;

app.post('/api/gdpval/tasks', async (req, res) => {
  const pendingCount = await db.query(
    'SELECT COUNT(*) FROM gdpval_tasks WHERE status = $1',
    ['pending']
  );

  if (pendingCount.rows[0].count >= MAX_PENDING_TASKS) {
    return res.status(429).json({
      success: false,
      error: `Queue is full (${MAX_PENDING_TASKS} pending tasks). Please try again later.`
    });
  }

  // ... rest of handler
});
```

---

### Issue #41-42: Additional Scaling Issues

See fixes for:
- #41: No worker auto-scaling
- #42: Unbounded log storage in database

---

## Database Design Issues

### Issue #43: Missing Status Constraint
**Severity:** Medium
**Location:** `admin/db/index.js:229`

**Fix:**
```sql
ALTER TABLE gdpval_tasks
ADD CONSTRAINT check_status
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- Also add constraint for priority
ALTER TABLE gdpval_tasks
ADD CONSTRAINT check_priority
CHECK (priority >= 0 AND priority <= 10);
```

---

### Issue #44: No Soft Delete Support
**Severity:** Medium
**Location:** `admin/db/index.js:1404-1411`

**Fix:**
```sql
-- Add soft delete columns
ALTER TABLE gdpval_tasks ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE gdpval_tasks ADD COLUMN deleted_by VARCHAR(255);

-- Create index for non-deleted tasks
CREATE INDEX idx_gdpval_tasks_not_deleted
  ON gdpval_tasks(created_at)
  WHERE deleted_at IS NULL;

-- Update delete function
const softDeleteGdpvalTask = async (taskId, deletedBy) => {
  await pool.query(
    `UPDATE gdpval_tasks
     SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2
     WHERE task_id = $1`,
    [taskId, deletedBy]
  );
};

-- Update queries to exclude deleted
const getActiveTasks = async () => {
  return pool.query(
    'SELECT * FROM gdpval_tasks WHERE deleted_at IS NULL ORDER BY created_at DESC'
  );
};
```

---

### Issue #45-46: Additional Database Issues

See fixes for:
- #45: Missing foreign key optimization
- #46: Missing composite index for search

---

## Code Quality Issues

### Issue #47: Hardcoded Admin IP
**Severity:** Medium
**Location:** `admin/services/gdpvalTaskService.js:206`

**Fix:**
```javascript
// Use environment variable
const ADMIN_PUBLIC_IP = process.env.ADMIN_PUBLIC_IP || (() => {
  // Auto-detect public IP if not set
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  throw new Error('ADMIN_PUBLIC_IP not set and could not auto-detect');
})();
```

---

### Issue #48: Magic Numbers Throughout
**Severity:** Low
**Location:** `admin/services/gdpvalTaskService.js:29-39`

**Fix:**
```javascript
// Extract to named constants at file top
const TIMEOUTS = {
  TASK_EXECUTION: 45 * 60 * 1000,      // 45 minutes
  MAX_PROCESSING_TIME: 60 * 60 * 1000, // 1 hour
  LOG_POLL_INTERVAL: 2000,              // 2 seconds
  STATUS_POLL_INTERVAL: 5000,           // 5 seconds
  SSH_COMMAND_TIMEOUT: 30000,           // 30 seconds
  MONITOR_CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 minutes
};

// Use throughout code
const timeout = TIMEOUTS.TASK_EXECUTION;
```

---

### Issue #49-52: Additional Code Quality Issues

See fixes for:
- #49: Duplicate escapeHtml functions
- #50: console.log for production logging
- #51: No TypeScript or JSDoc
- #52: No API versioning

---

## Pipeline-Specific Issues

### Issue #53: Missing tests/solution/ in Template
**Severity:** Medium
**Location:** `pipeline-experimenting/tasks/gdpval-template/`

**Fix:**
```bash
# Add to template directory
mkdir -p tasks/gdpval-template/tests/solution
echo "# Solution files will be copied here during setup" > tasks/gdpval-template/tests/solution/README.md
```

---

### Issue #54: Path Confusion in Instructions
**Severity:** High
**Location:** `pipeline-experimenting/pipelines/gdpval/instructions.txt:74-76`

**Fix:**
Add clarifying section to instructions.txt:

```markdown
## File Paths - Important Distinction

During the build phase:
- Solution files are located at: `tasks/{task_id}/tests/solution/`
- You can read them from: `Path("tests/solution/")`

In the Docker container (during test execution):
- Solution files are mounted at: `/tests/solution/`
- Reference them in solution.sh as: `/tests/solution/filename`
- Reference them in tests as: `read_file_safe("/tests/solution/filename")`

Example solution.sh:
```bash
#!/bin/bash
# Copy solution files to expected output locations
cp /tests/solution/output.csv /app/output.csv
```
```

---

### Issue #55: No LLM Judge Environment Validation
**Severity:** Medium
**Location:** `pipeline-experimenting/tasks/gdpval-template/docker-compose.yaml`

**Fix:**
```yaml
# Add validation step to pipeline config
pipeline:
  - step: validate_environment
    params:
      required_vars:
        - LLM_JUDGE_API_KEY
        - LLM_JUDGE_MODEL
      check_script: |
        if [ -z "$LLM_JUDGE_API_KEY" ]; then
          echo "ERROR: LLM_JUDGE_API_KEY not set"
          exit 1
        fi
```

---

### Issue #56-61: Additional Pipeline Issues

See fixes for:
- #56: source vs copy_from_parent confusion
- #57: gdpval_runner.py placeholder implementation
- #58: Missing multi-file solution guidance
- #59: No retry logic for LLM judge rate limits
- #60: validate_basic timeout too low
- #61: Conflicting dependency pinning rules

---

## Documentation Issues

### Issue #62: No Frontend Integration Docs
**Severity:** Medium

**Fix:**
Create `docs/FRONTEND_BACKEND_CONTRACT.md`:

```markdown
# GDPVal Frontend-Backend Contract

## Task Submission Flow

### Frontend sends:
```json
POST /api/gdpval/tasks
{
  "task_id": "abc123_task-name",
  "task_name": "Human readable name",
  "sector": "technology",
  "occupation": "software engineer",
  "instruction": "Task instructions...",
  "difficulty": "hard",
  "expert_time_min": 420,
  "sources": ["url1", "url2"],
  "rubrics": [
    { "criteria": "Correctness", "points": 50 }
  ],
  "solution_files": [
    { "filename": "output.csv", "content": "base64..." }
  ],
  "data_files": [...],
  "task_yaml": "base64...",
  "solution_sh": "base64...",
  "createdBy": "username"
}
```

### Backend stores:
- Main task in `gdpval_tasks` table
- Files as BYTEA in separate tables
- Creates pending task for workers

### Worker fetches:
- Reads from PostgreSQL
- Unpacks files to `tasks/{task_id}/`
- Runs pipeline
- Creates PR in contributor repo
```

---

### Issue #63-65: Additional Documentation Issues

See fixes for:
- #63: tasks.yaml misleading comments
- #64: No API documentation
- #65: No health check validation

---

## Testing & Observability

### Issue #66: No Test Coverage
**Severity:** High

**Fix:**
Create basic test suite:

```javascript
// tests/gdpval.test.js
const request = require('supertest');
const app = require('../server');

describe('GDPVal API', () => {
  test('POST /api/gdpval/tasks creates task', async () => {
    const response = await request(app)
      .post('/api/gdpval/tasks')
      .send({
        task_id: 'test123_sample',
        task_name: 'Test Task',
        // ... other fields
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  test('GET /api/gdpval/tasks returns paginated list', async () => {
    const response = await request(app)
      .get('/api/gdpval/tasks?page=1&limit=20');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('tasks');
    expect(response.body).toHaveProperty('pagination');
  });
});
```

---

### Issue #67: No Metrics/Observability
**Severity:** Medium

**Fix:**
```javascript
const promClient = require('prom-client');

// Create metrics
const taskCounter = new promClient.Counter({
  name: 'gdpval_tasks_total',
  help: 'Total number of tasks',
  labelNames: ['status']
});

const taskDuration = new promClient.Histogram({
  name: 'gdpval_task_duration_seconds',
  help: 'Task execution duration',
  buckets: [60, 300, 600, 1800, 3600]
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

---

### Issue #68: No Graceful Shutdown
**Severity:** Medium
**Location:** `admin/server.js`

**Fix:**
```javascript
// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`${signal} received, starting graceful shutdown...`);

  // Stop accepting new requests
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Close database pool
  await pool.end();
  console.log('Database connections closed');

  // Stop task monitoring
  for (const [taskId, monitor] of activeMonitors.entries()) {
    clearInterval(monitor.logInterval);
    clearInterval(monitor.statusInterval);
  }
  console.log('Task monitors stopped');

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## Additional Improvements

### Issue #69: No Audit Trail for Changes
**Fix:**
```sql
CREATE TABLE gdpval_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id VARCHAR(255),
  action VARCHAR(50),
  changed_by VARCHAR(255),
  changes JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_task ON gdpval_audit_log(task_id);
CREATE INDEX idx_audit_log_created ON gdpval_audit_log(created_at DESC);
```

---

### Issue #70: No Webhook Notifications
**Fix:**
```javascript
// Send webhook on task completion
async function notifyWebhook(event, data) {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error('Webhook notification failed:', error);
  }
}

// Call on events
await notifyWebhook('task.completed', { taskId, prUrl });
```

---

## Priority Roadmap

### Phase 1: Critical Fixes (Week 1)
- [ ] #1: Fix conflicting prompts
- [ ] #2: Document solution_files mapping
- [ ] #3: Add transaction wrapping
- [ ] #4: Fix server status race condition
- [ ] #6: Fix validate_model config
- [ ] #7: Add file virus scanning
- [ ] #32: Add CSRF protection

### Phase 2: High Priority (Week 2)
- [ ] #5: Fix memory leak
- [ ] #9: Optimize N+1 queries
- [ ] #10: Configure connection pooling
- [ ] #11: Clean up log files
- [ ] #12: Add database indexes
- [ ] #39: Support multi-task parallelization

### Phase 3: UX & Performance (Week 3-4)
- [ ] #14: Add search debouncing
- [ ] #15: Fix terminal refresh rate
- [ ] #18: Add URL state
- [ ] #27: Optimize stats queries
- [ ] #28: Migrate to JSONB
- [ ] #30: Fix task reordering

### Phase 4: Security & Scaling (Week 5-6)
- [ ] #33: Add file type validation
- [ ] #36: Add rate limiting
- [ ] #37: Add API authentication
- [ ] #40: Add queue depth limit
- [ ] #43: Add database constraints
- [ ] #44: Implement soft deletes

### Phase 5: Quality & Observability (Ongoing)
- [ ] #48: Extract magic numbers
- [ ] #51: Add JSDoc comments
- [ ] #66: Add test coverage
- [ ] #67: Add metrics
- [ ] #68: Add graceful shutdown
- [ ] #69: Add audit logging

---

## Summary Statistics

- **Critical (P0):** 7 issues - Fix immediately
- **High (P1):** 6 issues - Fix this week
- **Medium (P2):** 35 issues - Fix this month
- **Low (P3):** 22 issues - Backlog

**By Category:**
- Security: 7 issues
- Performance: 5 issues
- Database: 4 issues
- Pipeline: 9 issues
- UX: 13 issues
- Code Quality: 6 issues
- Scaling: 4 issues
- Documentation: 4 issues
- Testing: 3 issues
- Other: 15 issues

**Estimated Total Effort:** 8-10 weeks with 1 developer

---

*Analysis completed on December 26, 2025*
*For questions or clarifications, please open an issue in this repository.*
