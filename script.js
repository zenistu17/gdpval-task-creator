/**
 * GDPVal Task Creator - JavaScript Logic
 *
 * Handles form interactions, file uploads, task generation, and ZIP download
 */

// ============================================
// GDPVal Sectors and Occupations Data
// ============================================

const GDPVAL_DATA = {
  sectors: [
    {
      name: "Real Estate and Rental and Leasing",
      gdpShare: "13.8%",
      occupations: [
        "Property/Real Estate/Community Association Managers",
        "Counter and Rental Clerks",
        "Real Estate Sales Agents",
        "Real Estate Brokers",
        "Concierges"
      ]
    },
    {
      name: "Government",
      gdpShare: "11.3%",
      occupations: [
        "Compliance Officers",
        "Administrative Services Managers",
        "Child, Family, and School Social Workers",
        "First-Line Supervisors of Police and Detectives",
        "Recreation Workers"
      ]
    },
    {
      name: "Manufacturing",
      gdpShare: "10.0%",
      occupations: [
        "First-Line Supervisors of Production and Operating Workers",
        "Buyers and Purchasing Agents",
        "Shipping, Receiving, and Inventory Clerks",
        "Industrial Engineers",
        "Mechanical Engineers"
      ]
    },
    {
      name: "Professional, Scientific, and Technical Services",
      gdpShare: "8.1%",
      occupations: [
        "Software Developers",
        "Lawyers",
        "Accountants and Auditors",
        "Computer and Information Systems Managers",
        "Project Management Specialists"
      ]
    },
    {
      name: "Health Care and Social Assistance",
      gdpShare: "7.6%",
      occupations: [
        "Registered Nurses",
        "First-Line Supervisors of Office/Admin Support",
        "Medical & Health Services Managers",
        "Nurse Practitioners",
        "Medical Secretaries & Admin Assistants"
      ]
    },
    {
      name: "Finance and Insurance",
      gdpShare: "7.4%",
      occupations: [
        "Financial Managers",
        "Customer Service Representatives",
        "Securities, Commodities, and Financial Services Sales Agents",
        "Personal Financial Advisors",
        "Financial and Investment Analysts"
      ]
    },
    {
      name: "Retail Trade",
      gdpShare: "6.3%",
      occupations: [
        "General & Operations Managers",
        "First-Line Supervisors of Retail Sales Workers",
        "Pharmacists",
        "Private Detectives & Investigators"
      ]
    },
    {
      name: "Wholesale Trade",
      gdpShare: "5.8%",
      occupations: [
        "Sales Representatives, Wholesale & Manufacturing (Except Tech/Scientific)",
        "Sales Managers",
        "Sales Representatives, Wholesale & Manufacturing (Tech/Scientific)",
        "First-Line Supervisors of Non-Retail Sales Workers",
        "Order Clerks"
      ]
    },
    {
      name: "Information",
      gdpShare: "5.4%",
      occupations: [
        "Producers & Directors",
        "Editors",
        "News Analysts, Reporters, and Journalists",
        "Audio & Video Technicians",
        "Film & Video Editors"
      ]
    }
  ]
};

// ============================================
// File Type Icons
// ============================================

const FILE_ICONS = {
  'pdf': '📄',
  'doc': '📝',
  'docx': '📝',
  'md': '📋',
  'txt': '📃',
  'csv': '📊',
  'xlsx': '📊',
  'xls': '📊',
  'json': '🔧',
  'py': '🐍',
  'js': '⚡',
  'ts': '💎',
  'html': '🌐',
  'css': '🎨',
  'pptx': '📽️',
  'ppt': '📽️',
  'mov': '🎬',
  'mp4': '🎬',
  'avi': '🎬',
  'png': '🖼️',
  'jpg': '🖼️',
  'jpeg': '🖼️',
  'gif': '🖼️',
  'svg': '🖼️',
  'zip': '📦',
  'default': '📁'
};

// ============================================
// State Management
// ============================================

const state = {
  referenceFiles: [],
  solutionFiles: [],
  rubricItems: []
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initializeSectorDropdown();
  initializeOccupationDropdown();
  initializeTextarea();
  initializeFileUploads();
  initializeRubric();
  initializeFormSubmission();
  initializePreview();
  updateProgress();
});

// ============================================
// Sector & Occupation Dropdowns
// ============================================

function initializeSectorDropdown() {
  const sectorSelect = document.getElementById('sector');

  GDPVAL_DATA.sectors.forEach(sector => {
    const option = document.createElement('option');
    option.value = sector.name;
    option.textContent = `${sector.name} (${sector.gdpShare} of GDP)`;
    sectorSelect.appendChild(option);
  });

  sectorSelect.addEventListener('change', handleSectorChange);
}

function initializeOccupationDropdown() {
  const occupationSelect = document.getElementById('occupation');
  occupationSelect.addEventListener('change', updateProgress);
}

function handleSectorChange(e) {
  const selectedSector = e.target.value;
  const occupationSelect = document.getElementById('occupation');

  // Clear and disable if no sector selected
  occupationSelect.innerHTML = '<option value="">Select an occupation...</option>';

  if (!selectedSector) {
    occupationSelect.disabled = true;
    return;
  }

  // Find the sector and populate occupations
  const sector = GDPVAL_DATA.sectors.find(s => s.name === selectedSector);
  if (sector) {
    sector.occupations.forEach(occupation => {
      const option = document.createElement('option');
      option.value = occupation;
      option.textContent = occupation;
      occupationSelect.appendChild(option);
    });
    occupationSelect.disabled = false;
  }

  updateProgress();
}

// ============================================
// Textarea Character Count
// ============================================

function initializeTextarea() {
  const textarea = document.getElementById('instruction');
  const charCount = document.getElementById('charCount');

  textarea.addEventListener('input', () => {
    charCount.textContent = textarea.value.length;
    updateProgress();
  });
}

// ============================================
// File Upload Handling
// ============================================

function initializeFileUploads() {
  setupUploadZone('referenceZone', 'referenceInput', 'referenceList', 'referenceFiles');
  setupUploadZone('solutionZone', 'solutionInput', 'solutionList', 'solutionFiles');
}

function setupUploadZone(zoneId, inputId, listId, stateKey) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  // Drag and drop events
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files, stateKey, list);
  });

  // Click to upload
  input.addEventListener('change', (e) => {
    handleFiles(e.target.files, stateKey, list);
    input.value = ''; // Reset for re-upload
  });
}

function handleFiles(fileList, stateKey, listElement) {
  const files = Array.from(fileList);

  files.forEach(file => {
    // Check if already added
    if (state[stateKey].some(f => f.name === file.name)) {
      showToast('File already added', 'info');
      return;
    }

    state[stateKey].push(file);
    addFileToList(file, stateKey, listElement);
  });

  updateProgress();
}

function addFileToList(file, stateKey, listElement) {
  const extension = file.name.split('.').pop().toLowerCase();
  const icon = FILE_ICONS[extension] || FILE_ICONS.default;
  const size = formatFileSize(file.size);

  const fileItem = document.createElement('div');
  fileItem.className = 'file-item';
  fileItem.innerHTML = `
    <span class="file-icon">${icon}</span>
    <span class="file-name" title="${file.name}">${file.name}</span>
    <span class="file-size">${size}</span>
    <button type="button" class="file-remove" data-name="${file.name}">&times;</button>
  `;

  fileItem.querySelector('.file-remove').addEventListener('click', () => {
    state[stateKey] = state[stateKey].filter(f => f.name !== file.name);
    fileItem.remove();
    updateProgress();
  });

  listElement.appendChild(fileItem);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================
// Rubric Management
// ============================================

function initializeRubric() {
  const container = document.getElementById('rubricContainer');
  const addBtn = document.getElementById('addRubricBtn');

  // Add initial 3 rubric items
  for (let i = 0; i < 3; i++) {
    addRubricItem();
  }

  addBtn.addEventListener('click', addRubricItem);
}

function addRubricItem() {
  const container = document.getElementById('rubricContainer');
  const index = container.children.length + 1;

  const item = document.createElement('div');
  item.className = 'rubric-item';
  item.innerHTML = `
    <div class="form-group">
      <label class="form-label">
        <span class="label-icon">📋</span>
        Category ${index}
      </label>
      <input
        type="text"
        class="form-input rubric-name"
        placeholder="e.g., Correctness, Code Quality, Completeness"
        required
      >
      <textarea
        class="form-textarea rubric-desc"
        rows="2"
        placeholder="Describe what this category evaluates..."
        style="min-height: 60px; margin-top: 0.5rem;"
      ></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Points</label>
      <input
        type="number"
        class="form-input rubric-points"
        min="1"
        max="100"
        value="10"
        required
      >
    </div>
    <button type="button" class="rubric-remove">&times;</button>
  `;

  const removeBtn = item.querySelector('.rubric-remove');
  removeBtn.addEventListener('click', () => {
    if (container.children.length > 3) {
      item.remove();
      updateRubricNumbers();
      updateProgress();
    } else {
      showToast('Minimum 3 rubric categories required', 'error');
    }
  });

  // Update progress on input
  item.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', updateProgress);
  });

  container.appendChild(item);
  updateProgress();
}

function updateRubricNumbers() {
  const items = document.querySelectorAll('.rubric-item');
  items.forEach((item, index) => {
    const label = item.querySelector('.form-label');
    label.innerHTML = `<span class="label-icon">📋</span> Category ${index + 1}`;
  });
}

function getRubricData() {
  const items = document.querySelectorAll('.rubric-item');
  return Array.from(items).map(item => ({
    name: item.querySelector('.rubric-name').value.trim(),
    description: item.querySelector('.rubric-desc').value.trim(),
    points: parseInt(item.querySelector('.rubric-points').value, 10) || 10
  })).filter(r => r.name);
}

// ============================================
// Progress Tracking
// ============================================

function updateProgress() {
  const form = document.getElementById('taskForm');
  let completed = 0;
  let total = 6;

  // Sector
  if (document.getElementById('sector').value) completed++;

  // Occupation
  if (document.getElementById('occupation').value) completed++;

  // Instruction
  if (document.getElementById('instruction').value.trim().length >= 50) completed++;

  // Reference files (optional, but counts if added)
  if (state.referenceFiles.length > 0) completed++;
  else total--;

  // Solution files
  if (state.solutionFiles.length > 0) completed++;

  // Rubric
  const rubrics = getRubricData();
  if (rubrics.length >= 3) completed++;

  const progress = Math.round((completed / total) * 100);
  document.getElementById('progressFill').style.width = `${progress}%`;
}

// ============================================
// Form Submission
// ============================================

function initializeFormSubmission() {
  const form = document.getElementById('taskForm');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    generateAndDownload();
  });
}

function validateForm() {
  const sector = document.getElementById('sector').value;
  const occupation = document.getElementById('occupation').value;
  const instruction = document.getElementById('instruction').value.trim();
  const rubrics = getRubricData();

  if (!sector) {
    showToast('Please select a sector', 'error');
    return false;
  }

  if (!occupation) {
    showToast('Please select an occupation', 'error');
    return false;
  }

  if (instruction.length < 50) {
    showToast('Task instruction must be at least 50 characters', 'error');
    return false;
  }

  if (state.solutionFiles.length === 0) {
    showToast('Please upload at least one solution file', 'error');
    return false;
  }

  if (rubrics.length < 3) {
    showToast('Please add at least 3 rubric categories', 'error');
    return false;
  }

  return true;
}

// ============================================
// Task Generation
// ============================================

function generateTaskYaml() {
  const sector = document.getElementById('sector').value;
  const occupation = document.getElementById('occupation').value;
  const instruction = document.getElementById('instruction').value.trim();
  const difficulty = document.getElementById('difficulty').value;
  const expertTime = document.getElementById('expertTime').value;
  const juniorTime = document.getElementById('juniorTime').value;
  const rubrics = getRubricData();

  const totalPoints = rubrics.reduce((sum, r) => sum + r.points, 0);

  // Build rubric string
  const rubricStr = rubrics.map(r =>
    `  - ${r.name} (${r.points} points): ${r.description || 'Evaluation criteria'}`
  ).join('\n');

  // Construct instruction with rubric
  const fullInstruction = `${instruction}

Rubric: ${totalPoints} points
${rubricStr}`;

  // Generate YAML
  const yaml = `instruction: |-
${fullInstruction.split('\n').map(line => '  ' + line).join('\n')}
difficulty: ${difficulty}
category: gdpval
tags:
  - gdpval
  - ${occupation.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
parser_name: pytest
max_agent_timeout_sec: 900.0
max_test_timeout_sec: 300.0
run_tests_in_same_shell: false
disable_asciinema: false
estimated_duration_sec: ${parseInt(expertTime) * 60}
expert_time_estimate_min: ${expertTime}
junior_time_estimate_min: ${juniorTime}
sector: ${sector}
occupation: ${occupation}
`;

  return yaml;
}

function generateSolutionSh() {
  const solutionFiles = state.solutionFiles.map(f => f.name);

  let script = `#!/bin/bash

# GDPVal Task Solution Script
# This script sets up the solution environment and runs the solution files

set -e

echo "Setting up solution environment..."

# Create solution output directory
mkdir -p /app/output

# Copy solution files from protected directory
`;

  solutionFiles.forEach(file => {
    script += `cp /solution/${file} /app/output/ 2>/dev/null || echo "Note: ${file} not found in solution directory"\n`;
  });

  script += `
echo "Solution files prepared in /app/output/"
echo "Solution execution complete."
`;

  return script;
}

function generateDockerfile() {
  return `FROM ghcr.io/laude-institute/t-bench/python-3-13:20250620

ENV PYTHONUNBUFFERED=1 \\
    PYTHONDONTWRITEBYTECODE=1 \\
    PIP_NO_CACHE_DIR=1 \\
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \\
    tmux \\
    asciinema \\
    && rm -rf /var/lib/apt/lists/*

# DO NOT REMOVE THESE OR THE TESTS WILL FAIL
RUN pip install pytest httpx pydantic pyyaml
`;
}

function generateDockerCompose() {
  return `services:
  client:
    build:
      dockerfile: Dockerfile
    image: \${T_BENCH_TASK_DOCKER_CLIENT_IMAGE_NAME}
    container_name: \${T_BENCH_TASK_DOCKER_CLIENT_CONTAINER_NAME}
    command: ["sh", "-c", "sleep infinity"]
    working_dir: /app
    environment:
      - TEST_DIR=\${T_BENCH_TEST_DIR}
      - LLM_JUDGE_API_KEY=\${LLM_JUDGE_API_KEY:?LLM_JUDGE_API_KEY environment variable is not set}
      - LLM_JUDGE_MODEL=\${LLM_JUDGE_MODEL:?LLM_JUDGE_MODEL environment variable is not set}
      # Python settings
      - PYTHONUNBUFFERED=1
      - PYTHONDONTWRITEBYTECODE=1
    volumes:
      - \${T_BENCH_TASK_LOGS_PATH}:\${T_BENCH_CONTAINER_LOGS_PATH}
      - \${T_BENCH_TASK_AGENT_LOGS_PATH}:\${T_BENCH_CONTAINER_AGENT_LOGS_PATH}
`;
}

function generateRunTests() {
  return `#!/bin/bash

pytest $TEST_DIR/test_outputs.py -v -rA
`;
}

function generateTestFile() {
  const rubrics = getRubricData();
  const occupation = document.getElementById('occupation').value;
  const instruction = document.getElementById('instruction').value.trim();
  const totalPoints = rubrics.reduce((sum, r) => sum + r.points, 0);

  // Generate rubric scoring section
  const rubricScoring = rubrics.map((r, i) =>
    `${i + 1}. ${r.name.toUpperCase()} (0-${r.points} points):
   - ${r.points}: Excellent - ${r.description || 'Fully meets requirements'}
   - ${Math.floor(r.points * 0.7)}-${r.points - 1}: Good - Minor issues
   - ${Math.floor(r.points * 0.4)}-${Math.floor(r.points * 0.7) - 1}: Adequate - Notable gaps
   - 1-${Math.floor(r.points * 0.4) - 1}: Poor - Significant issues
   - 0: Not attempted or completely wrong`
  ).join('\n\n');

  const rubricFields = rubrics.map(r =>
    `    ${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}: int = Field(ge=0, le=${r.points})`
  ).join('\n');

  const rubricPrintStatements = rubrics.map(r => {
    const key = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return `        print(f"${r.name}: {scores.get('${key}', 'N/A')}/${r.points}")`;
  }).join('\n');

  return `#!/usr/bin/env python3
"""
GDPVal Task - Tests and LLM-as-a-Judge Evaluation.

Occupation: ${occupation}
Deterministic tests verify basic requirements, LLM judge evaluates quality.

Environment Variables:
    LLM_JUDGE_API_KEY: API key for OpenRouter
    LLM_JUDGE_MODEL: Optional model override (default: anthropic/claude-sonnet-4)
"""

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Optional

import httpx
import pytest
import yaml
from pydantic import BaseModel, Field


class LLMJudgeResponse(BaseModel):
    """Pydantic model for LLM judge response."""
${rubricFields}
    total: int = Field(ge=0, le=${totalPoints})
    feedback: str


# Constants
TASK_YAML = Path("/app/task.yaml")
OUTPUT_DIR = Path("/app/output")

RUBRIC = """
Score the submission on the following rubric (total ${totalPoints} points):

${rubricScoring}
"""


def read_file_safe(path: Path) -> Optional[str]:
    """Read a file if it exists, return None otherwise."""
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def get_task_description() -> str:
    """Read task description from task.yaml."""
    if TASK_YAML.exists():
        with open(TASK_YAML) as f:
            task = yaml.safe_load(f)
        return task.get("instruction", "")
    return ""


# =============================================================================
# LLM Judge Configuration and Calling
# =============================================================================


def get_llm_judge_config() -> Optional[dict]:
    """Get LLM judge configuration from environment variables."""
    api_key = os.environ.get("LLM_JUDGE_API_KEY")
    model = os.environ.get("LLM_JUDGE_MODEL")

    if not api_key:
        return None

    return {
        "api_key": api_key,
        "model": model or "anthropic/claude-sonnet-4",
        "fallback_model": "openai/gpt-4.1",
    }


def extract_json_from_text(text: str) -> Optional[dict]:
    """Extract JSON object from text, handling various formats."""
    text = text.strip()

    # Remove markdown code blocks if present
    if "\`\`\`" in text:
        parts = text.split("\`\`\`")
        for part in parts[1::2]:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            try:
                return json.loads(part)
            except json.JSONDecodeError:
                continue

    # Try to parse the entire text as JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON object with braces
    brace_depth = 0
    start_idx = None
    for i, char in enumerate(text):
        if char == '{':
            if brace_depth == 0:
                start_idx = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and start_idx is not None:
                candidate = text[start_idx:i+1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    start_idx = None
                    continue

    return None


def call_llm_judge(prompt: str, config: dict, max_retries: int = 5) -> dict:
    """Call LLM judge via OpenRouter with fallback and retries."""
    api_key = config["api_key"]
    model = config["model"]
    fallback_model = config["fallback_model"]

    system_prompt = """You are an expert evaluator for ${occupation} tasks.
You have deep expertise in this field and will evaluate submissions fairly and thoroughly.
Evaluate the provided work and return a JSON response with scores.
Be strict but fair - the work should be correct, complete, and professional.
IMPORTANT: Your response MUST contain valid JSON with all required score fields and feedback."""

    user_content = [{"type": "text", "text": prompt}]

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    last_error = None

    for attempt in range(max_retries):
        print(f"[LLM Judge] Attempt {attempt + 1}/{max_retries}")

        text = None
        for m in [model, fallback_model]:
            try:
                print(f"[LLM Judge] Trying model: {m}")
                payload = {
                    "model": m,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                }
                with httpx.Client(timeout=120.0) as client:
                    response = client.post(url, headers=headers, json=payload)
                    print(f"[LLM Judge] Response status: {response.status_code}")
                    response.raise_for_status()
                    data = response.json()
                text = data["choices"][0]["message"]["content"]
                print(f"[LLM Judge] Model {m} succeeded")
                break
            except Exception as e:
                last_error = e
                print(f"[LLM Judge] Model {m} failed: {e}")
                if m == fallback_model:
                    break
                continue

        if text is None:
            print(f"[LLM Judge] All models failed on attempt {attempt + 1}, retrying...")
            time.sleep(1)
            continue

        parsed = extract_json_from_text(text)

        if parsed is None:
            last_error = ValueError("Could not parse JSON from judge response")
            print(f"[LLM Judge] JSON parsing failed on attempt {attempt + 1}, retrying...")
            time.sleep(1)
            continue

        try:
            validated = LLMJudgeResponse(**parsed)
            return validated.model_dump()
        except Exception as e:
            last_error = e
            print(f"[LLM Judge] Validation failed on attempt {attempt + 1}: {e}, retrying...")
            time.sleep(1)
            continue

    raise ValueError(f"All {max_retries} attempts failed. Last error: {last_error}")


def build_judge_prompt(submission_content: str, task_description: str) -> str:
    """Build the complete prompt for the LLM judge."""
    return f"""You are evaluating a submission for a ${occupation} task.

## TASK:
{task_description}

## SCORING RUBRIC:
{RUBRIC}

## SUBMISSION:
{submission_content}

## YOUR EVALUATION:

Based on the submission above, evaluate this work according to the rubric.
Consider accuracy, completeness, and professional quality.

Return your evaluation as JSON with the following fields:
${rubrics.map(r => `- "${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}": score from 0-${r.points}`).join('\n')}
- "total": sum of all scores (0-${totalPoints})
- "feedback": 2-4 sentences explaining your scores
"""


# =============================================================================
# Tests - Basic Requirements
# =============================================================================


class TestBasicRequirements:
    """Tests that verify basic task requirements."""

    def test_output_directory_exists(self):
        """Output directory should exist with solution files."""
        assert OUTPUT_DIR.exists(), f"Output directory not found: {OUTPUT_DIR}"

    def test_output_has_files(self):
        """Output directory should contain solution files."""
        files = list(OUTPUT_DIR.glob("*"))
        assert len(files) > 0, "Output directory is empty - no solution files found"


# =============================================================================
# Tests - LLM Judge
# =============================================================================


class TestLLMJudge:
    """LLM-as-a-Judge evaluation of the submission."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures."""
        self.config = get_llm_judge_config()

    def test_llm_judge_evaluation(self):
        """LLM evaluates the overall quality of the submission."""
        if self.config is None:
            pytest.skip("LLM judge not configured - set LLM_JUDGE_API_KEY")

        if not OUTPUT_DIR.exists():
            pytest.fail("Cannot evaluate - output directory does not exist")

        # Collect submission content
        submission_parts = []
        for file_path in OUTPUT_DIR.glob("*"):
            if file_path.is_file():
                try:
                    content = file_path.read_text(encoding="utf-8")
                    submission_parts.append(f"### File: {file_path.name}\\n\\n{content}")
                except Exception:
                    submission_parts.append(f"### File: {file_path.name} (binary file)")

        if not submission_parts:
            pytest.fail("No files found in output directory")

        submission_content = "\\n\\n".join(submission_parts)
        task_description = get_task_description()
        prompt = build_judge_prompt(submission_content, task_description)

        print(f"\\n[LLM Judge] Prompt length: {len(prompt)} chars")

        scores = call_llm_judge(prompt, self.config)

        print(f"\\n{'='*60}")
        print("LLM JUDGE EVALUATION")
        print("=" * 60)
${rubricPrintStatements}
        print(f"TOTAL: {scores.get('total', 'N/A')}/${totalPoints}")
        print(f"\\nFeedback: {scores.get('feedback', 'N/A')}")
        print("=" * 60)

        # Assert minimum score (50%)
        total = scores.get("total", 0)
        min_score = ${Math.floor(totalPoints / 2)}
        assert total >= min_score, f"Score too low: {total}/${totalPoints}. Feedback: {scores.get('feedback', '')}"


# =============================================================================
# Test Runner
# =============================================================================


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-rA"])
`;
}

// ============================================
// Preview Modal
// ============================================

function initializePreview() {
  const previewBtn = document.getElementById('previewBtn');
  const closePreview = document.getElementById('closePreview');
  const modal = document.getElementById('previewModal');
  const backdrop = modal.querySelector('.modal-backdrop');
  const downloadBtn = document.getElementById('downloadBtn');
  const tabs = document.querySelectorAll('.tab-btn');

  previewBtn.addEventListener('click', () => {
    if (!validateForm()) return;
    showPreview();
  });

  closePreview.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  backdrop.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  downloadBtn.addEventListener('click', generateAndDownload);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      document.querySelectorAll('.code-preview, .structure-preview').forEach(el => {
        el.classList.add('hidden');
      });

      if (tabName === 'yaml') {
        document.getElementById('yamlPreview').classList.remove('hidden');
      } else if (tabName === 'solution') {
        document.getElementById('solutionPreview').classList.remove('hidden');
      } else {
        document.getElementById('structurePreview').classList.remove('hidden');
      }
    });
  });
}

function showPreview() {
  const modal = document.getElementById('previewModal');

  // Generate previews
  document.getElementById('yamlPreview').textContent = generateTaskYaml();
  document.getElementById('solutionPreview').textContent = generateSolutionSh();

  // Generate structure
  const structurePreview = document.getElementById('structurePreview');
  structurePreview.innerHTML = generateStructurePreview();

  modal.classList.add('active');
}

function generateStructurePreview() {
  const taskId = generateTaskId();

  let html = `<div class="structure-tree">
    <div class="tree-item folder">📁 ${taskId}/</div>
    <div class="tree-item file">📄 task.yaml</div>
    <div class="tree-item file">📄 solution.sh</div>
    <div class="tree-item file">📄 Dockerfile</div>
    <div class="tree-item file">📄 docker-compose.yaml</div>
    <div class="tree-item file">📄 run-tests.sh</div>
    <div class="tree-item folder">📁 tests/</div>
    <div class="tree-item file" style="padding-left: 2.5rem;">📄 test_outputs.py</div>`;

  if (state.referenceFiles.length > 0) {
    html += `<div class="tree-item folder">📁 data/</div>`;
    state.referenceFiles.forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      const icon = FILE_ICONS[ext] || FILE_ICONS.default;
      html += `<div class="tree-item file" style="padding-left: 2.5rem;">${icon} ${f.name}</div>`;
    });
  }

  html += `<div class="tree-item folder" style="color: var(--green);">🔐 solution/ (protected)</div>`;
  state.solutionFiles.forEach(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    const icon = FILE_ICONS[ext] || FILE_ICONS.default;
    html += `<div class="tree-item file" style="padding-left: 2.5rem; color: var(--green);">${icon} ${f.name}</div>`;
  });

  html += '</div>';
  return html;
}

function generateTaskId() {
  const occupation = document.getElementById('occupation').value;
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const slug = occupation.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  const hash = Math.random().toString(36).slice(2, 8);
  return `gdpval-${slug}-${hash}`;
}

// ============================================
// ZIP Generation & Download
// ============================================

async function generateAndDownload() {
  if (!validateForm()) return;

  const btn = document.getElementById('generateBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="btn-icon">⏳</span> Generating...';
  btn.disabled = true;

  try {
    const zip = new JSZip();
    const taskId = generateTaskId();
    const folder = zip.folder(taskId);

    // Add core files
    folder.file('task.yaml', generateTaskYaml());
    folder.file('solution.sh', generateSolutionSh());
    folder.file('Dockerfile', generateDockerfile());
    folder.file('docker-compose.yaml', generateDockerCompose());
    folder.file('run-tests.sh', generateRunTests());

    // Add tests folder
    const tests = folder.folder('tests');
    tests.file('test_outputs.py', generateTestFile());

    // Add data folder with reference files
    if (state.referenceFiles.length > 0) {
      const data = folder.folder('data');
      for (const file of state.referenceFiles) {
        const content = await readFileAsArrayBuffer(file);
        data.file(file.name, content);
      }
    }

    // Add solution folder with solution files
    const solution = folder.folder('solution');
    for (const file of state.solutionFiles) {
      const content = await readFileAsArrayBuffer(file);
      solution.file(file.name, content);
    }

    // Generate ZIP
    const blob = await zip.generateAsync({ type: 'blob' });

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${taskId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Task package generated successfully!', 'success');

    // Close modal if open
    document.getElementById('previewModal').classList.remove('active');

  } catch (error) {
    console.error('Generation error:', error);
    showToast('Error generating task package', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ============================================
// Toast Notifications
// ============================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.4s reverse forwards';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
