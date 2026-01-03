# TODO for Icelos: HTTP API Wrapper

## Problem

Frontend makes HTTP calls like `fetch('/api/gdpval/tasks')` but your backend is Python CLI scripts.

Frontend CANNOT connect until you create an HTTP API wrapper.

## Solution: Create FastAPI Server

Location: `/tmp/GDPVAL/backend/api_server.py`

### Step 1: Install Dependencies

```bash
cd /tmp/GDPVAL
uv add fastapi uvicorn python-multipart
```

### Step 2: Create HTTP API Server

Create `backend/api_server.py`:

```python
#!/usr/bin/env python3
"""
HTTP API wrapper for GDPVAL task submission.
Wraps the existing task_submit.py CLI scripts with REST endpoints.
"""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import List
import yaml
import base64
import os
import sys

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add pipeline to path
sys.path.insert(0, str(Path(__file__).parent.parent / "pipeline"))

from scripts.task_submit import submit_task
from scripts.task_registry import TaskRegistry

app = FastAPI(title="GDPVal API", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Models ====================

class TaskResponse(BaseModel):
    task_id: str
    status: str
    pr_url: str | None = None
    branch_name: str | None = None
    created_at: str | None = None

class SectorResponse(BaseModel):
    sectors: List[str]

class OccupationResponse(BaseModel):
    occupations: List[str]

# ==================== Static Data ====================

# BLS Sectors (can be moved to JSON file later)
SECTORS = [
    "Agriculture, Forestry, Fishing and Hunting",
    "Mining, Quarrying, and Oil and Gas Extraction",
    "Utilities",
    "Construction",
    "Manufacturing",
    "Wholesale Trade",
    "Retail Trade",
    "Transportation and Warehousing",
    "Information",
    "Finance and Insurance",
    "Real Estate and Rental and Leasing",
    "Professional, Scientific, and Technical Services",
    "Management of Companies and Enterprises",
    "Administrative and Support and Waste Management Services",
    "Educational Services",
    "Health Care and Social Assistance",
    "Arts, Entertainment, and Recreation",
    "Accommodation and Food Services",
    "Other Services (except Public Administration)",
    "Public Administration"
]

# BLS Occupations by sector (subset - expand as needed)
OCCUPATIONS = {
    "Finance and Insurance": [
        "Financial Analysts",
        "Personal Financial Advisors",
        "Insurance Underwriters",
        "Financial Examiners",
        "Credit Analysts",
        "Loan Officers",
        "Tax Preparers",
        "Financial Managers",
        "Accountants and Auditors"
    ],
    "Health Care and Social Assistance": [
        "Registered Nurses",
        "Physicians and Surgeons",
        "Medical and Health Services Managers",
        "Pharmacists",
        "Physical Therapists",
        "Clinical Laboratory Technologists",
        "Emergency Medical Technicians",
        "Medical Records Specialists"
    ],
    "Professional, Scientific, and Technical Services": [
        "Software Developers",
        "Computer Systems Analysts",
        "Network Architects",
        "Database Administrators",
        "Civil Engineers",
        "Mechanical Engineers",
        "Architects",
        "Lawyers",
        "Accountants"
    ],
    "Information": [
        "Software Developers",
        "Web Developers",
        "Database Administrators",
        "Computer Network Architects",
        "Information Security Analysts",
        "Film and Video Editors",
        "Technical Writers",
        "Broadcast Technicians"
    ],
    # Add more sectors as needed - for MVP just these 4 are fine
}

# ==================== Helper Functions ====================

def build_task_yaml(
    task_id: str,
    task_name: str,
    sector: str,
    occupation: str,
    instruction: str,
    difficulty: str,
    expert_time_min: int,
    rubrics: list,
    sources: list
) -> str:
    """Build task.yaml content from form data"""
    task_data = {
        "task_id": task_id,
        "task_name": task_name,
        "sector": sector,
        "occupation": occupation,
        "instruction": instruction,
        "difficulty": difficulty,
        "expert_time_min": expert_time_min,
        "rubrics": rubrics,
    }
    if sources:
        task_data["sources"] = sources

    return yaml.dump(task_data, default_flow_style=False, sort_keys=False)

# ==================== Endpoints ====================

@app.get("/")
async def root():
    return {"status": "ok", "service": "GDPVal API"}

@app.get("/api/gdpval/health")
async def health():
    return {"status": "healthy"}

@app.post("/api/gdpval/tasks", response_model=TaskResponse)
async def create_task(
    task_id: str = Form(...),
    task_name: str = Form(...),
    sector: str = Form(...),
    occupation: str = Form(...),
    instruction: str = Form(...),
    difficulty: str = Form("medium"),
    expert_time_min: int = Form(420),
    rubrics: str = Form("[]"),  # JSON string
    sources: str = Form("[]"),  # JSON string
    task_yaml: str = Form(None),  # Pre-built YAML
    solution_sh: str = Form(None),  # Solution script
    solution_files: List[UploadFile] = File(None),  # Solution files
    data_files: List[UploadFile] = File(None),  # Reference data files
):
    """Create a new GDPVal task - wraps task_submit.py"""
    try:
        import json
        rubrics_list = json.loads(rubrics) if rubrics else []
        sources_list = json.loads(sources) if sources else []

        # Create temp task package directory
        with tempfile.TemporaryDirectory() as tmp_dir:
            task_dir = Path(tmp_dir) / task_id
            task_dir.mkdir()

            # Create task.yaml
            if task_yaml:
                (task_dir / "task.yaml").write_text(task_yaml)
            else:
                yaml_content = build_task_yaml(
                    task_id, task_name, sector, occupation, instruction,
                    difficulty, expert_time_min, rubrics_list, sources_list
                )
                (task_dir / "task.yaml").write_text(yaml_content)

            # Create data/ directory
            data_dir = task_dir / "data"
            data_dir.mkdir()
            if data_files:
                for file in data_files:
                    if file and file.filename:
                        content = await file.read()
                        (data_dir / file.filename).write_bytes(content)

            # Create tests/solution/ directory
            solution_dir = task_dir / "tests" / "solution"
            solution_dir.mkdir(parents=True)

            # Write solution.sh if provided
            if solution_sh:
                (solution_dir / "solution.sh").write_text(solution_sh)

            # Write solution files
            if solution_files:
                for file in solution_files:
                    if file and file.filename:
                        content = await file.read()
                        (solution_dir / file.filename).write_bytes(content)

            # Call existing task_submit logic
            submit_task(task_id, task_dir)

            # Get result from DynamoDB
            registry = TaskRegistry()
            task = registry.get_task(task_id)

            if not task:
                raise HTTPException(status_code=500, detail="Task created but not found in registry")

            return TaskResponse(
                task_id=task.task_id,
                status=task.status,
                pr_url=task.pr_url,
                branch_name=task.branch_name,
                created_at=task.created_at
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/gdpval/tasks/mine")
async def get_my_tasks(
    status: str = None,
    limit: int = 50,
    offset: int = 0
):
    """Get tasks for current user (TODO: add auth)"""
    # TODO: Filter by user once auth is implemented
    # For now, return all tasks
    try:
        registry = TaskRegistry()
        # TODO: Implement scan_tasks method in TaskRegistry
        # For MVP, just return empty list
        return {"tasks": [], "pagination": {"total": 0, "limit": limit, "offset": offset}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/gdpval/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Get task details"""
    try:
        registry = TaskRegistry()
        task = registry.get_task(task_id)

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        return TaskResponse(
            task_id=task.task_id,
            status=task.status,
            pr_url=task.pr_url,
            branch_name=task.branch_name,
            created_at=task.created_at
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/gdpval/sectors", response_model=SectorResponse)
async def get_sectors():
    """Get list of BLS sectors"""
    return SectorResponse(sectors=SECTORS)

@app.get("/api/gdpval/occupations", response_model=OccupationResponse)
async def get_occupations(sector: str = None):
    """Get list of BLS occupations for a sector"""
    if sector:
        occupations = OCCUPATIONS.get(sector, [])
    else:
        # Return all occupations
        occupations = []
        for occs in OCCUPATIONS.values():
            occupations.extend(occs)
        occupations = list(set(occupations))  # Deduplicate

    return OccupationResponse(occupations=sorted(occupations))

# ==================== Templates (TODO) ====================

@app.get("/api/gdpval/templates")
async def get_templates():
    """Get saved templates (TODO: implement DynamoDB table)"""
    return {"success": True, "templates": []}

@app.post("/api/gdpval/templates")
async def create_template():
    """Save a template (TODO: implement)"""
    raise HTTPException(status_code=501, detail="Templates not implemented yet")

@app.delete("/api/gdpval/templates/{template_id}")
async def delete_template(template_id: str):
    """Delete a template (TODO: implement)"""
    raise HTTPException(status_code=501, detail="Templates not implemented yet")

# ==================== Run Server ====================

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
```

### Step 3: Create backend directory structure

```bash
mkdir -p /tmp/GDPVAL/backend
mv api_server.py /tmp/GDPVAL/backend/
```

### Step 4: Test the API

```bash
# Start server
cd /tmp/GDPVAL
uv run python backend/api_server.py

# In another terminal, test it:
curl http://localhost:8000/api/gdpval/health
curl http://localhost:8000/api/gdpval/sectors
curl http://localhost:8000/api/gdpval/occupations?sector=Finance+and+Insurance
```

### Step 5: Update DynamoDB Schema (Optional Enhancement)

Add these fields to `GDPValTasks` table for better tracking:
- `created_by` (string) - username who created task
- `task_name` (string) - human-readable name
- `sector` (string) - industry sector
- `occupation` (string) - job role

Update `task_registry.py`:
```python
def create_task(
    self,
    task_id: str,
    status: str,
    branch_name: str,
    repo: str,
    created_by: str = None,  # ADD THIS
    task_name: str = None,   # ADD THIS
    sector: str = None,      # ADD THIS
    occupation: str = None,  # ADD THIS
    # ... rest
):
    # ... existing code ...
    if created_by:
        item["created_by"] = created_by
    if task_name:
        item["task_name"] = task_name
    if sector:
        item["sector"] = sector
    if occupation:
        item["occupation"] = occupation
    # ... rest
```

### Step 6: Deploy

Once tested locally:

1. **Deploy to your server**:
   ```bash
   # Example with systemd
   sudo tee /etc/systemd/system/gdpval-api.service << EOF
   [Unit]
   Description=GDPVal API Server
   After=network.target

   [Service]
   User=ubuntu
   WorkingDirectory=/home/ubuntu/GDPVAL
   ExecStart=/home/ubuntu/.local/bin/uv run python backend/api_server.py
   Restart=always
   Environment="PORT=8000"
   Environment="CONTRIBUTOR_REPO=your-repo"
   Environment="GITHUB_ORG=your-org"

   [Install]
   WantedBy=multi-user.target
   EOF

   sudo systemctl daemon-reload
   sudo systemctl enable gdpval-api
   sudo systemctl start gdpval-api
   ```

2. **Setup nginx reverse proxy**:
   ```nginx
   server {
       listen 80;
       server_name api.gdpval.com;  # Your domain

       location / {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

3. **Tell Zenitzzu your API URL**:
   - Example: `https://api.gdpval.com`
   - Zenitzzu will update `frontend/config.js` with your URL

## That's It!

**Minimal scope**: Just implement the 4 main endpoints:
1. ✅ `POST /api/gdpval/tasks` - Task creation
2. ✅ `GET /api/gdpval/tasks/mine` - List user tasks
3. ✅ `GET /api/gdpval/sectors` - Sectors list
4. ✅ `GET /api/gdpval/occupations` - Occupations list

**Templates can wait** - Not needed for MVP.

## Questions?

- See `/tmp/GDPVAL/frontend/API_MAPPING.md` for detailed API spec
- See `/tmp/GDPVAL/frontend/STATUS.md` for architecture overview
