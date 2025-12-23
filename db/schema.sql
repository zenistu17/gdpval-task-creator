-- GDPVal Task Creator - PostgreSQL Schema
-- Run this script to create the required database tables

-- Enable UUID extension for unique task IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main tasks table
CREATE TABLE IF NOT EXISTS gdpval_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) UNIQUE NOT NULL,  -- Format: {hash}_{task_name}
    task_name VARCHAR(100) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    occupation VARCHAR(200) NOT NULL,
    instruction TEXT NOT NULL,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
    expert_time_min INTEGER NOT NULL,
    junior_time_min INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending'  -- pending, processing, completed, failed
);

-- Rubric items table
CREATE TABLE IF NOT EXISTS gdpval_rubrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) REFERENCES gdpval_tasks(task_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    points INTEGER NOT NULL DEFAULT 10,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Solution files metadata
CREATE TABLE IF NOT EXISTS gdpval_solution_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) REFERENCES gdpval_tasks(task_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    extension VARCHAR(50),
    mime_type VARCHAR(100),
    storage_path TEXT,  -- Path to file in object storage (S3, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Data/reference files metadata
CREATE TABLE IF NOT EXISTS gdpval_data_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) REFERENCES gdpval_tasks(task_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    extension VARCHAR(50),
    mime_type VARCHAR(100),
    storage_path TEXT,  -- Path to file in object storage (S3, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Task YAML content (for quick retrieval)
CREATE TABLE IF NOT EXISTS gdpval_task_yaml (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) UNIQUE REFERENCES gdpval_tasks(task_id) ON DELETE CASCADE,
    yaml_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Solution shell script content
CREATE TABLE IF NOT EXISTS gdpval_solution_sh (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(100) UNIQUE REFERENCES gdpval_tasks(task_id) ON DELETE CASCADE,
    script_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_sector ON gdpval_tasks(sector);
CREATE INDEX IF NOT EXISTS idx_tasks_occupation ON gdpval_tasks(occupation);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON gdpval_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON gdpval_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rubrics_task_id ON gdpval_rubrics(task_id);
CREATE INDEX IF NOT EXISTS idx_solution_files_task_id ON gdpval_solution_files(task_id);
CREATE INDEX IF NOT EXISTS idx_data_files_task_id ON gdpval_data_files(task_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_gdpval_tasks_updated_at ON gdpval_tasks;
CREATE TRIGGER update_gdpval_tasks_updated_at
    BEFORE UPDATE ON gdpval_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- View for task summary with file counts
CREATE OR REPLACE VIEW gdpval_tasks_summary AS
SELECT
    t.id,
    t.task_id,
    t.task_name,
    t.sector,
    t.occupation,
    t.difficulty,
    t.expert_time_min,
    t.junior_time_min,
    t.status,
    t.created_at,
    (SELECT COUNT(*) FROM gdpval_solution_files sf WHERE sf.task_id = t.task_id) as solution_file_count,
    (SELECT COUNT(*) FROM gdpval_data_files df WHERE df.task_id = t.task_id) as data_file_count,
    (SELECT SUM(points) FROM gdpval_rubrics r WHERE r.task_id = t.task_id) as total_points,
    (SELECT COUNT(*) FROM gdpval_rubrics r WHERE r.task_id = t.task_id) as rubric_count
FROM gdpval_tasks t;
