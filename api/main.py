"""
GDPVal Task Creator - Backend API
FastAPI server for storing tasks in PostgreSQL
"""

import os
import uuid
from datetime import datetime
from typing import Optional

import asyncpg
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="GDPVal Task Creator API",
    description="API for storing GDPVal tasks in PostgreSQL",
    version="1.0.0"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection pool
db_pool: Optional[asyncpg.Pool] = None

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/gdpval_tasks"
)


# Pydantic models
class RubricItem(BaseModel):
    name: str
    description: Optional[str] = None
    points: int = 10


class FileMetadata(BaseModel):
    name: str
    size: int
    extension: str
    # Optional media metadata
    width: Optional[int] = None
    height: Optional[int] = None
    resolution: Optional[str] = None
    duration_seconds: Optional[float] = None
    duration_formatted: Optional[str] = None


class TaskCreate(BaseModel):
    task_id: str
    task_name: str
    sector: str
    occupation: str
    instruction: str
    difficulty: str = "medium"
    expert_time_min: int
    junior_time_min: int
    rubrics: list[RubricItem]
    solution_files: list[FileMetadata]
    data_files: list[FileMetadata] = []
    task_yaml: str
    solution_sh: str


class TaskResponse(BaseModel):
    id: str
    task_id: str
    task_name: str
    sector: str
    occupation: str
    status: str
    created_at: datetime


@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)


@app.on_event("shutdown")
async def shutdown():
    global db_pool
    if db_pool:
        await db_pool.close()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/tasks", response_model=TaskResponse)
async def create_task(task: TaskCreate):
    """Create a new GDPVal task"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")

    async with db_pool.acquire() as conn:
        async with conn.transaction():
            # Insert main task
            row = await conn.fetchrow(
                """
                INSERT INTO gdpval_tasks
                    (task_id, task_name, sector, occupation, instruction,
                     difficulty, expert_time_min, junior_time_min)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, task_id, task_name, sector, occupation, status, created_at
                """,
                task.task_id,
                task.task_name,
                task.sector,
                task.occupation,
                task.instruction,
                task.difficulty,
                task.expert_time_min,
                task.junior_time_min
            )

            # Insert rubrics
            for i, rubric in enumerate(task.rubrics):
                await conn.execute(
                    """
                    INSERT INTO gdpval_rubrics (task_id, name, description, points, sort_order)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    task.task_id,
                    rubric.name,
                    rubric.description,
                    rubric.points,
                    i
                )

            # Insert solution file metadata
            for file_meta in task.solution_files:
                await conn.execute(
                    """
                    INSERT INTO gdpval_solution_files
                        (task_id, file_name, file_size, extension,
                         width, height, resolution, duration_seconds, duration_formatted)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    """,
                    task.task_id,
                    file_meta.name,
                    file_meta.size,
                    file_meta.extension,
                    file_meta.width,
                    file_meta.height,
                    file_meta.resolution,
                    file_meta.duration_seconds,
                    file_meta.duration_formatted
                )

            # Insert data file metadata
            for file_meta in task.data_files:
                await conn.execute(
                    """
                    INSERT INTO gdpval_data_files
                        (task_id, file_name, file_size, extension,
                         width, height, resolution, duration_seconds, duration_formatted)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    """,
                    task.task_id,
                    file_meta.name,
                    file_meta.size,
                    file_meta.extension,
                    file_meta.width,
                    file_meta.height,
                    file_meta.resolution,
                    file_meta.duration_seconds,
                    file_meta.duration_formatted
                )

            # Insert task.yaml content
            await conn.execute(
                """
                INSERT INTO gdpval_task_yaml (task_id, yaml_content)
                VALUES ($1, $2)
                """,
                task.task_id,
                task.task_yaml
            )

            # Insert solution.sh content
            await conn.execute(
                """
                INSERT INTO gdpval_solution_sh (task_id, script_content)
                VALUES ($1, $2)
                """,
                task.task_id,
                task.solution_sh
            )

            return TaskResponse(
                id=str(row['id']),
                task_id=row['task_id'],
                task_name=row['task_name'],
                sector=row['sector'],
                occupation=row['occupation'],
                status=row['status'],
                created_at=row['created_at']
            )


@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Get a task by its ID"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, task_id, task_name, sector, occupation, status, created_at
            FROM gdpval_tasks
            WHERE task_id = $1
            """,
            task_id
        )

        if not row:
            raise HTTPException(status_code=404, detail="Task not found")

        return TaskResponse(
            id=str(row['id']),
            task_id=row['task_id'],
            task_name=row['task_name'],
            sector=row['sector'],
            occupation=row['occupation'],
            status=row['status'],
            created_at=row['created_at']
        )


@app.get("/api/tasks")
async def list_tasks(
    sector: Optional[str] = None,
    occupation: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """List tasks with optional filters"""
    if not db_pool:
        raise HTTPException(status_code=503, detail="Database not available")

    async with db_pool.acquire() as conn:
        query = """
            SELECT id, task_id, task_name, sector, occupation, status, created_at
            FROM gdpval_tasks
            WHERE 1=1
        """
        params = []
        param_count = 0

        if sector:
            param_count += 1
            query += f" AND sector = ${param_count}"
            params.append(sector)

        if occupation:
            param_count += 1
            query += f" AND occupation = ${param_count}"
            params.append(occupation)

        if status:
            param_count += 1
            query += f" AND status = ${param_count}"
            params.append(status)

        param_count += 1
        query += f" ORDER BY created_at DESC LIMIT ${param_count}"
        params.append(limit)

        param_count += 1
        query += f" OFFSET ${param_count}"
        params.append(offset)

        rows = await conn.fetch(query, *params)

        return [
            TaskResponse(
                id=str(row['id']),
                task_id=row['task_id'],
                task_name=row['task_name'],
                sector=row['sector'],
                occupation=row['occupation'],
                status=row['status'],
                created_at=row['created_at']
            )
            for row in rows
        ]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
