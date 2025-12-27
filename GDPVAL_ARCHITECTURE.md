# GDPVal Task Creator - Complete System Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Frontend Components](#frontend-components)
4. [Backend Components](#backend-components)
5. [Pipeline & Worker](#pipeline--worker)
6. [Data Flow](#data-flow)
7. [Database Schema](#database-schema)
8. [File Structure](#file-structure)
9. [Key Code References](#key-code-references)

---

## System Overview

The GDPVal Task Creator is a complete end-to-end system for creating, managing, and processing AI evaluation tasks. It consists of:

1. **Frontend UI** - Web interface for task creation and queue monitoring
2. **Backend API** - Node.js/Express server with PostgreSQL database
3. **Remote Workers** - Python workers on remote servers that process tasks
4. **Claude SDK** - Generates test harnesses using AI
5. **GitHub Integration** - Automatically creates PRs in contributor repos

**Purpose:** Enable contributors to create GDPVal (GDP Validation) tasks without writing test code manually. The system uses Claude to generate test harnesses automatically.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
└─────────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
    ┌─────────────────────┐       ┌─────────────────────┐
    │   GDPVal Task Page  │       │  GDPVal Queue Page  │
    │  (Task Creation)    │       │   (Monitoring)      │
    └─────────────────────┘       └─────────────────────┘
          gdpval-task.html              gdpval-queue.html
          gdpval/script.js              gdpval/queue-script.js
                │                             │
                └──────────────┬──────────────┘
                               │ HTTP API Calls
                               ▼
    ┌───────────────────────────────────────────────────┐
    │          EXPRESS.JS SERVER (admin)                │
    │  https://github.com/Parsewave-internal/admin      │
    │                                                   │
    │  Routes:                                          │
    │  - POST /api/gdpval/tasks (create task)           │
    │  - GET /api/gdpval/tasks (list queue)             │
    │  - GET /api/gdpval/servers (server status)        │
    │  - POST /api/gdpval/tasks/:id/retry               │
    └───────────────────────────────────────────────────┘
              │                             │
              │ Database writes             │ Database reads
              ▼                             ▼
    ┌───────────────────────────────────────────────────┐
    │          POSTGRESQL DATABASE                      │
    │                                                   │
    │  Tables:                                          │
    │  - gdpval_tasks (main task records)               │
    │  - gdpval_rubrics (scoring criteria)              │
    │  - gdpval_solution_files (expected outputs)       │
    │  - gdpval_data_files (input data)                 │
    │  - gdpval_task_yaml (task definition)             │
    │  - gdpval_solution_sh (solution script)           │
    └───────────────────────────────────────────────────┘
                               │
                               │ Polled every 10s
                               ▼
    ┌───────────────────────────────────────────────────┐
    │     REMOTE WORKER (on pipeline servers)           │
    │  https://github.com/Parsewave-internal/           │
    │    pipeline-experimenting/tree/gdpval-main        │
    │                                                   │
    │  scripts/gdpval_worker.py                         │
    │  - Polls for status='pending'                     │
    │  - Fetches task data from PostgreSQL              │
    │  - Sets up task directory                         │
    │  - Runs Claude SDK to generate tests              │
    │  - Creates PR in contributor repo                 │
    └───────────────────────────────────────────────────┘
                               │
           ┌───────────────────┴───────────────────┐
           │                                       │
           ▼                                       ▼
    ┌─────────────────┐                 ┌─────────────────┐
    │  CLAUDE SDK     │                 │  GitHub API     │
    │  (AI Generation)│                 │  (PR Creation)  │
    └─────────────────┘                 └─────────────────┘
           │
           ▼
    Generates:
    - tests/test_outputs.py (LLM-as-a-judge tests)
    - Dockerfile (task environment)
```

---

## Frontend Components

### 1. GDPVal Task Page (`gdpval-task.html`)

**Purpose:** Create new GDPVal tasks

**Location:** https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval-task.html

**Features:**
- **5-section form:**
  1. Identity (task name, sector, occupation)
  2. Description (instruction text, 150+ chars required)
  3. Files (reference data, solution files)
  4. Rubric (minimum 3 categories)
  5. Sources (optional, for public domain data)

- **File uploads:**
  - Reference files → `/app/data/` (inputs for AI)
  - Solution files → `/tests/solution/` (expected outputs, hidden from AI)
  - Supports: PDF, DOCX, CSV, JSON, images, videos, audio, code files
  - Max 50MB per file, 200MB total

- **Auto-save:**
  - Saves draft every 30 seconds to localStorage
  - Restored on page reload

- **Templates:**
  - Save common task configurations
  - Load from saved templates

**JavaScript:** `/public/gdpval/script.js`

**Key Functions:**
```javascript
// Line 1518: Submit task
async function generateAndDownload() {
  const taskId = getOrCreateTaskId();
  await saveToDatabase(taskId);  // POST /api/gdpval/tasks
}

// Line 1449: Save to database
async function saveToDatabase(taskId) {
  const payload = {
    task_id, task_name, sector, occupation,
    instruction, difficulty: 'hard',
    expert_time_min: 420,  // Fixed at 7 hours
    rubrics, solution_files, data_files,
    task_yaml, solution_sh
  };

  const response = await fetch('/api/gdpval/tasks', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
```

**Data stored in DB:**
- Task metadata (name, sector, occupation, instruction)
- Rubrics with points
- Files as Base64 (binary stored in PostgreSQL)
- Generated task.yaml and solution.sh

---

### 2. GDPVal Queue Page (`gdpval-queue.html`)

**Purpose:** Monitor task processing queue and server status

**Location:** https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval-queue.html

**Features:**

**Server Status Section:**
- Real-time server health from `/api/gdpval/servers`
- Shows CPU, memory, disk usage
- Worker status (idle/busy)

**Queue Tabs:**
- **Pending:** Tasks waiting for processing
- **Processing:** Currently running tasks
- **Completed:** Finished tasks with PR links
- **Failed:** Tasks that encountered errors

**Task Actions:**
- **Retry:** Re-queue failed tasks
- **Delete:** Remove tasks (double confirmation required)
- **Cancel:** Stop running tasks
- **View Logs:** Terminal-style modal showing real-time progress

**Search & Filters:**
- Search by task ID, name, sector, occupation
- Filter by sector
- Filter by priority (0, 5, 10)

**Bulk Operations:**
- Select multiple tasks
- Bulk retry
- Bulk delete

**JavaScript:** `/public/gdpval/queue-script.js`

**Key Functions:**
```javascript
// Line 56: Initialize and auto-refresh
document.addEventListener('DOMContentLoaded', () => {
  loadData();  // GET /api/gdpval/tasks + /api/gdpval/servers
  setInterval(loadData, 10000);  // Refresh every 10 seconds
});

// Line 128: Bulk retry
async function bulkRetry() {
  await fetchWithAuth('/api/gdpval/tasks/bulk-retry', {
    method: 'POST',
    body: JSON.stringify({ taskIds: Array.from(selectedTasks) })
  });
}
```

**Real-time updates:**
- Polls every 10 seconds
- Shows progress percentage
- Displays server assignment
- ETA calculations

---

## Backend Components

### 1. Database Schema (`db/index.js`)

**Location:** https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/db/index.js

**Tables:**

#### `gdpval_tasks` (Main table)
```sql
CREATE TABLE gdpval_tasks (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(255) UNIQUE NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  sector VARCHAR(255) NOT NULL,
  occupation VARCHAR(255) NOT NULL,
  instruction TEXT NOT NULL,
  difficulty VARCHAR(50) DEFAULT 'hard',
  expert_time_min INTEGER DEFAULT 420,
  sources JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'pending',
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Status values:**
- `pending` → Waiting for worker to pick up
- `processing` → Worker is running Claude SDK
- `completed` → PR created successfully
- `failed` → Error occurred

#### `gdpval_rubrics`
```sql
CREATE TABLE gdpval_rubrics (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(255) REFERENCES gdpval_tasks(task_id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  points INTEGER DEFAULT 10,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `gdpval_solution_files` & `gdpval_data_files`
```sql
CREATE TABLE gdpval_solution_files (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(255) REFERENCES gdpval_tasks(task_id),
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  extension VARCHAR(50),
  file_content BYTEA,  -- Binary storage (base64 decoded)

  -- Media metadata (optional)
  width INTEGER,
  height INTEGER,
  resolution VARCHAR(50),
  duration_seconds NUMERIC,
  duration_formatted VARCHAR(50),

  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Database Functions:**

```javascript
// Line 1050 in db/index.js
const insertGdpvalTask = async ({
  taskId, taskName, sector, occupation,
  instruction, difficulty, expertTimeMin,
  sources, createdBy
}) => {
  const result = await pool.query(`
    INSERT INTO gdpval_tasks (
      task_id, task_name, sector, occupation,
      instruction, difficulty, expert_time_min,
      sources, created_by, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
    RETURNING *
  `, [taskId, taskName, sector, occupation, instruction,
      difficulty, expertTimeMin, JSON.stringify(sources), createdBy]);
  return result.rows[0];
};

// Line 1100: Get queue filtered by status
const getGdpvalQueue = async (status = null, limit = 100, offset = 0) => {
  let query = `SELECT * FROM gdpval_tasks`;
  if (status && status !== 'all') {
    query += ` WHERE status = $1`;
  }
  query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const result = await pool.query(query, status ? [status] : []);
  return result.rows;
};
```

---

### 2. API Routes (`routes/gdpvalTask.js`)

**Location:** https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/routes/gdpvalTask.js

**Endpoints:**

#### `POST /api/gdpval/tasks` (Create task)
```javascript
// Line 29
app.post('/api/gdpval/tasks', requireApiAuth, async (req, res) => {
  const {
    task_id, task_name, sector, occupation,
    instruction, difficulty, expert_time_min,
    sources, rubrics, solution_files, data_files,
    task_yaml, solution_sh
  } = req.body;

  // Validate file sizes (server-side check)
  // - Max 50MB per file
  // - Max 200MB total

  // Insert main task
  const task = await db.insertGdpvalTask({...});

  // Insert rubrics
  for (const rubric of rubrics) {
    await db.insertGdpvalRubric({...});
  }

  // Insert solution files (decode base64 → binary)
  for (const file of solution_files) {
    const fileContent = Buffer.from(file.content, 'base64');
    await db.insertGdpvalSolutionFile({...});
  }

  // Insert data files
  for (const file of data_files) {
    const fileContent = Buffer.from(file.content, 'base64');
    await db.insertGdpvalDataFile({...});
  }

  res.json({ task_id, status: 'pending' });
});
```

#### `GET /api/gdpval/tasks` (List queue)
```javascript
// Line 250
app.get('/api/gdpval/tasks', requireApiAuth, async (req, res) => {
  const status = req.query.status || 'all';
  const limit = parseInt(req.query.limit || '100');
  const offset = parseInt(req.query.offset || '0');

  const tasks = await db.getGdpvalQueue(status, limit, offset);
  const total = await db.getGdpvalQueueCount(status);

  res.json({
    tasks,
    total,
    limit,
    offset,
    totalPages: Math.ceil(total / limit)
  });
});
```

#### `POST /api/gdpval/tasks/:taskId/retry` (Retry failed task)
```javascript
// Line 300
app.post('/api/gdpval/tasks/:taskId/retry', requireApiAuth, async (req, res) => {
  const { taskId } = req.params;

  // Reset status to pending
  await db.updateGdpvalTaskStatus(taskId, 'pending');

  res.json({ status: 'pending' });
});
```

#### `GET /api/gdpval/servers` (Server status)
```javascript
// Line 350
app.get('/api/gdpval/servers', requireApiAuth, async (req, res) => {
  // Fetches server metrics via SSH
  const servers = await gdpvalService.getServerStatus();
  res.json({ servers });
});
```

**File serving:**
- Solution files are served as binary downloads
- Data files are served for preview
- Task YAML is served as text

---

### 3. Server Integration (`server.js`)

**Location:** https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/server.js

**Key Integration:**

```javascript
// Mount GDPVal routes
const gdpvalRoutes = require('./routes/gdpvalTask');
gdpvalRoutes(app, requireApiAuth, requireAuth, requireGuidedTaskAccess);

// Serve GDPVal pages
app.get('/gdpval-task', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/gdpval-task.html'));
});

app.get('/gdpval-queue', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/gdpval-queue.html'));
});
```

**Authentication:**
- `requireAuth` - User must be logged in
- `requireApiAuth` - API endpoints require user session
- User info available as `req.user`

---

## Pipeline & Worker

### 1. Worker Script (`gdpval_worker.py`)

**Location:** https://github.com/Parsewave-internal/pipeline-experimenting/blob/gdpval-main/scripts/gdpval_worker.py

**Main Loop:**

```python
# Line 191
async def worker_loop():
    """Polls database for pending tasks every 10 seconds."""
    log.info("worker_start", f"Polling every {POLL_INTERVAL}s")

    while True:
        pending_tasks = get_pending_tasks(limit=1)

        if pending_tasks:
            for task_id in pending_tasks:
                await process_task(task_id)

        await asyncio.sleep(POLL_INTERVAL)  # Default 10 seconds
```

**Task Processing Pipeline:**

```python
# Line 137
async def process_task(task_id: str) -> bool:
    # Step 1: Mark as processing
    update_task_status(task_id, "processing")

    # Step 2: Fetch task from PostgreSQL
    source_path = fetch_from_postgres(task_id)
    # Downloads:
    # - task.yaml
    # - data files
    # - solution files
    # - docker-compose.yaml template

    # Step 3: Setup task directory
    task_path = setup_task_directory(source_path, task_id)
    # Creates structure:
    # task_id/
    #   task.yaml
    #   docker-compose.yaml
    #   data/
    #     <reference files>
    #   tests/solution/
    #     <solution files>

    # Step 4: Run Claude SDK to generate test harness
    build_success, metadata = await run_gdpval_build(task_id)
    # Claude generates:
    # - tests/test_outputs.py (LLM-as-a-judge tests)
    # - Dockerfile (task environment)

    # Step 5: Deploy to contributor repo and create PR
    deploy_success, pr_url = await deploy_to_repo(task_id, task_path)

    # Step 6: Update final status
    update_task_status(task_id, "completed")
```

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `POLL_INTERVAL` - Seconds between polls (default 10)
- `SKIP_BUILD` - Skip Claude SDK step (testing)
- `SKIP_DEPLOY` - Skip PR creation (testing)

**Database Connection:**
```python
# Line 43
def get_pending_tasks(limit: int = 1) -> list[str]:
    conn = get_postgres_connection()  # psycopg2 connection
    cur = conn.cursor()
    cur.execute("""
        SELECT task_id FROM gdpval_tasks
        WHERE status = 'pending'
        ORDER BY created_at
        LIMIT %s
    """, (limit,))
    return [row[0] for row in cur.fetchall()]
```

---

### 2. Claude SDK Build (`gdpval_build.py`)

**Referenced in worker, generates test harness**

**Instructions:** https://github.com/Parsewave-internal/pipeline-experimenting/blob/gdpval-main/pipelines/gdpval/instructions.txt

**What Claude generates:**

#### `tests/test_outputs.py`
- Deterministic checks (file existence, parseability)
- LLM-as-a-Judge evaluation comparing agent output vs. human solution
- Pydantic models for structured scoring
- Uses OpenRouter API for LLM judge

**Example structure:**
```python
class TestLLMJudge:
    def test_llm_judge_evaluation(self):
        """LLM evaluation comparing agent output to human solution."""
        # Read human solution
        human_solution = read_file("/tests/solution/analysis.md")

        # Read agent output
        agent_output = read_file("/app/output/analysis.md")

        # Build comprehensive prompt
        prompt = f"""
        TASK: {task_description}
        RUBRIC: {rubric_from_task_yaml}
        HUMAN REFERENCE: {human_solution}
        AGENT OUTPUT: {agent_output}

        Score each rubric criterion...
        """

        # Call LLM judge
        scores = call_llm_judge(prompt, config)

        # Assert passing threshold (70%)
        assert scores["total"] >= 14, f"Score: {scores['total']}/20"
```

#### `Dockerfile`
- Starts from `ghcr.io/laude-institute/t-bench/python-3-13:20250620`
- Installs task-specific dependencies (e.g., pandas, numpy)
- Copies data files to `/app/data/`
- **Important:** All Python dependencies must be pinned (e.g., `pandas==2.2.0`)

**Key instruction excerpts:**
```
YOUR JOB IS TO GENERATE ONLY:
1. tests/test_outputs.py - Tests comparing agent output vs human solution
2. Dockerfile - Environment setup with pinned dependencies

ABSOLUTELY DO NOT:
- Add files to data/ folder
- Modify task.yaml
- Modify docker-compose.yaml

LLM JUDGE CHECKS (Primary evaluation):
- Compare agent output to human reference at /tests/solution/
- Use rubric from task.yaml for scoring
- Comprehensive prompts with task context
```

---

### 3. Deployment (`deploy_local_tasks.py`)

**Creates PR in contributor repository**

**Process:**
1. Copy task files to contributor repo (`contributions-zenistu17`)
2. Create branch: `test-gdpval-{task_id}`
3. Commit with message
4. Push to GitHub
5. Create PR via GitHub API
6. Add bot command comment: `/bot3 full-check`

**PR Structure:**
```
contributor_tasks/
  {task_id}/
    task.yaml
    Dockerfile
    docker-compose.yaml
    data/
      <reference files>
      metadata.json
    tests/
      test_outputs.py (generated by Claude)
      solution/
        <solution files>
        metadata.json
```

---

## Data Flow

### Complete Flow: Task Creation → PR

```
1. USER creates task on frontend
   ↓
2. Frontend submits to POST /api/gdpval/tasks
   - Encodes files as Base64
   - Sends metadata + rubrics + files
   ↓
3. Backend saves to PostgreSQL
   - Inserts gdpval_tasks (status='pending')
   - Inserts rubrics, files (binary), task.yaml, solution.sh
   ↓
4. Worker polls database every 10s
   - Finds status='pending'
   - Updates to status='processing'
   ↓
5. Worker fetches task from PostgreSQL
   - Downloads all files
   - Sets up task directory
   ↓
6. Worker runs Claude SDK
   - Claude reads task.yaml, data files, solution files
   - Claude generates:
     * tests/test_outputs.py (with LLM judge)
     * Dockerfile (with pinned dependencies)
   ↓
7. Worker deploys to GitHub
   - Creates branch in contributor repo
   - Commits task files + generated tests
   - Creates PR
   - Adds bot command
   ↓
8. Worker updates status='completed'
   - Stores PR URL
   ↓
9. Queue page shows completed task
   - User can click PR link
   - Bot runs validation checks
```

### File Encoding Flow

**Frontend → Database:**
```javascript
// Frontend (script.js line 1657)
function readFileAsBase64(file) {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  const base64 = reader.result.split(',')[1];  // Remove data URL prefix
  return base64;
}

// Backend (gdpvalTask.js line 126)
const fileContent = Buffer.from(file.content, 'base64');  // Decode to binary
await db.insertGdpvalSolutionFile({ fileContent });  // Store as BYTEA
```

**Database → Worker:**
```python
# Worker fetches binary from PostgreSQL
SELECT file_content FROM gdpval_solution_files WHERE task_id = %s

# Writes binary to disk
with open(f"tests/solution/{file_name}", 'wb') as f:
    f.write(file_content)
```

---

## Database Schema

### Complete ERD

```
gdpval_tasks (1)
├── id (SERIAL PRIMARY KEY)
├── task_id (VARCHAR UNIQUE) ← Foreign key for other tables
├── task_name
├── sector
├── occupation
├── instruction (TEXT)
├── difficulty
├── expert_time_min
├── sources (JSONB)
├── status (pending|processing|completed|failed)
├── created_by
├── created_at
└── updated_at

gdpval_rubrics (N)
├── id (SERIAL PRIMARY KEY)
├── task_id → gdpval_tasks.task_id
├── name
├── description
├── points
├── sort_order
└── created_at

gdpval_solution_files (N)
├── id (SERIAL PRIMARY KEY)
├── task_id → gdpval_tasks.task_id
├── file_name
├── file_size
├── extension
├── file_content (BYTEA) ← Binary storage
├── width, height, resolution (for images/videos)
├── duration_seconds, duration_formatted (for audio/video)
└── created_at

gdpval_data_files (N)
├── Same structure as gdpval_solution_files

gdpval_task_yaml (1)
├── id (SERIAL PRIMARY KEY)
├── task_id → gdpval_tasks.task_id
├── yaml_content (TEXT)
└── created_at

gdpval_solution_sh (1)
├── id (SERIAL PRIMARY KEY)
├── task_id → gdpval_tasks.task_id
├── script_content (TEXT)
└── created_at
```

**Indexes:**
- `gdpval_tasks.task_id` (UNIQUE)
- `gdpval_tasks.status` (for queue filtering)
- `gdpval_tasks.created_at` (for ordering)

---

## File Structure

### Frontend Repository
```
https://github.com/Parsewave-internal/admin/tree/gdpval-task-creator

admin/
├── public/
│   ├── gdpval-task.html          ← Task creation page
│   ├── gdpval-queue.html         ← Queue monitoring page
│   └── gdpval/
│       ├── script.js              ← Task page logic
│       ├── style.css              ← Task page styles
│       ├── queue-script.js        ← Queue page logic
│       └── queue-style.css        ← Queue page styles
│
├── routes/
│   └── gdpvalTask.js              ← API endpoints
│
├── db/
│   └── index.js                   ← Database functions (lines 1050-1200)
│
├── services/
│   └── gdpvalTaskService.js       ← Server status checks
│
└── server.js                      ← Main Express app
```

### Pipeline Repository
```
https://github.com/Parsewave-internal/pipeline-experimenting/tree/gdpval-main

pipeline-experimenting/
├── scripts/
│   ├── gdpval_worker.py           ← Background worker (polls DB)
│   ├── gdpval_runner.py           ← Task fetching from PostgreSQL
│   ├── gdpval_build.py            ← Claude SDK runner
│   └── deploy_local_tasks.py      ← GitHub PR creation
│
└── pipelines/gdpval/
    └── instructions.txt            ← Claude's instructions for test generation
```

### Contributor Repository (Output)
```
https://github.com/zenistu17/gdpval-task-creator

contributions-zenistu17/
└── contributor_tasks/
    └── abc123_task-name/          ← Generated task structure
        ├── task.yaml
        ├── Dockerfile (generated by Claude)
        ├── docker-compose.yaml
        ├── data/
        │   ├── metadata.json
        │   └── <reference files>
        └── tests/
            ├── test_outputs.py (generated by Claude)
            └── solution/
                ├── metadata.json
                └── <solution files>
```

---

## Key Code References

### Frontend

**Task Creation Form:**
- Form HTML: [`public/gdpval-task.html`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval-task.html)
- Form logic: [`public/gdpval/script.js:203-220`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval/script.js#L203-L220)
- File upload handler: [`script.js:767-795`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval/script.js#L767-L795)
- Submit handler: [`script.js:1518-1553`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval/script.js#L1518-L1553)
- Database save: [`script.js:1449-1516`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval/script.js#L1449-L1516)

**Queue Monitoring:**
- Queue HTML: [`public/gdpval-queue.html`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval-queue.html)
- Queue logic: [`public/gdpval/queue-script.js:56-67`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval/queue-script.js#L56-L67)
- Task filtering: [`queue-script.js:184-200`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval/queue-script.js#L184-L200)
- Bulk operations: [`queue-script.js:125-154`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/public/gdpval/queue-script.js#L125-L154)

### Backend

**API Endpoints:**
- Create task: [`routes/gdpvalTask.js:29-192`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/routes/gdpvalTask.js#L29-L192)
- Get queue: [`routes/gdpvalTask.js:250-280`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/routes/gdpvalTask.js#L250-L280)
- Retry task: [`routes/gdpvalTask.js:300-320`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/routes/gdpvalTask.js#L300-L320)

**Database Functions:**
- Insert task: [`db/index.js:1050-1070`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/db/index.js#L1050-L1070)
- Insert rubric: [`db/index.js:1080-1095`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/db/index.js#L1080-L1095)
- Insert files: [`db/index.js:1100-1130`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/db/index.js#L1100-L1130)
- Get queue: [`db/index.js:1150-1170`](https://github.com/Parsewave-internal/admin/blob/gdpval-task-creator/db/index.js#L1150-L1170)

### Pipeline

**Worker:**
- Main loop: [`scripts/gdpval_worker.py:191-216`](https://github.com/Parsewave-internal/pipeline-experimenting/blob/gdpval-main/scripts/gdpval_worker.py#L191-L216)
- Process task: [`gdpval_worker.py:137-188`](https://github.com/Parsewave-internal/pipeline-experimenting/blob/gdpval-main/scripts/gdpval_worker.py#L137-L188)
- Poll database: [`gdpval_worker.py:43-56`](https://github.com/Parsewave-internal/pipeline-experimenting/blob/gdpval-main/scripts/gdpval_worker.py#L43-L56)

**Claude Instructions:**
- Test generation: [`pipelines/gdpval/instructions.txt:1-206`](https://github.com/Parsewave-internal/pipeline-experimenting/blob/gdpval-main/pipelines/gdpval/instructions.txt#L1-L206)
- LLM judge requirements: [`instructions.txt:43-112`](https://github.com/Parsewave-internal/pipeline-experimenting/blob/gdpval-main/pipelines/gdpval/instructions.txt#L43-L112)
- Dockerfile requirements: [`instructions.txt:167-195`](https://github.com/Parsewave-internal/pipeline-experimenting/blob/gdpval-main/pipelines/gdpval/instructions.txt#L167-L195)

---

## Summary

**System Components:**
1. **Frontend** - React-like web UI for task creation and monitoring
2. **Backend** - Express.js API with PostgreSQL for persistence
3. **Worker** - Python background process polling for tasks
4. **Claude SDK** - AI generates test harnesses automatically
5. **GitHub** - PRs created in contributor repos

**Data Flow:**
User creates task → Saved to PostgreSQL → Worker polls → Claude generates tests → PR created → Queue shows completion

**Key Technologies:**
- **Frontend:** Vanilla JS, JSZip, Fetch API
- **Backend:** Node.js, Express, PostgreSQL (pg driver)
- **Worker:** Python, asyncio, psycopg2
- **AI:** Claude SDK (Anthropic), OpenRouter (LLM judge)
- **Deployment:** Git, GitHub API, SSH

**Repository Links:**
- Admin: https://github.com/Parsewave-internal/admin/tree/gdpval-task-creator
- Pipeline: https://github.com/Parsewave-internal/pipeline-experimenting/tree/gdpval-main
- Output: https://github.com/zenistu17/gdpval-task-creator

---

**Last Updated:** December 27, 2024
**Author:** Claude (analyzing codebase)
**Purpose:** Comprehensive documentation for developers and maintainers
