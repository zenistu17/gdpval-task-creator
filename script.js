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
  'webm': '🎬',
  'mkv': '🎬',
  'png': '🖼️',
  'jpg': '🖼️',
  'jpeg': '🖼️',
  'gif': '🖼️',
  'svg': '🖼️',
  'webp': '🖼️',
  'bmp': '🖼️',
  'mp3': '🎵',
  'wav': '🎵',
  'ogg': '🎵',
  'flac': '🎵',
  'aac': '🎵',
  'm4a': '🎵',
  'zip': '📦',
  'default': '📁'
};

// File type categories for metadata extraction
const FILE_CATEGORIES = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
  video: ['mp4', 'mov', 'avi', 'webm', 'mkv'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
};

// ============================================
// API Configuration
// ============================================

const API_CONFIG = {
  baseUrl: window.GDPVAL_API_URL || 'http://localhost:8000',
  enabled: true  // Set to false to disable API calls
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
    option.textContent = sector.name;
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
  const taskName = document.getElementById('taskName').value.trim();
  const sector = document.getElementById('sector').value;
  const occupation = document.getElementById('occupation').value;
  const instruction = document.getElementById('instruction').value.trim();
  const rubrics = getRubricData();

  if (!taskName) {
    showToast('Please enter a task name', 'error');
    return false;
  }

  if (!/^[a-z0-9-]+$/.test(taskName)) {
    showToast('Task name must be lowercase with hyphens only', 'error');
    return false;
  }

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
  const taskName = document.getElementById('taskName').value.trim();
  const sector = document.getElementById('sector').value;
  const occupation = document.getElementById('occupation').value;
  const instruction = document.getElementById('instruction').value.trim();
  const difficulty = document.getElementById('difficulty').value;
  // Time inputs are now in hours - convert to minutes for YAML
  const expertTimeHours = parseFloat(document.getElementById('expertTime').value) || 0;
  const juniorTimeHours = parseFloat(document.getElementById('juniorTime').value) || 0;
  const expertTimeMin = Math.round(expertTimeHours * 60);
  const juniorTimeMin = Math.round(juniorTimeHours * 60);
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
  const yaml = `task_name: ${taskName}
instruction: |-
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
estimated_duration_sec: ${expertTimeMin * 60}
expert_time_estimate_min: ${expertTimeMin}
junior_time_estimate_min: ${juniorTimeMin}
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
    <div class="tree-item file">📄 solution.sh</div>`;

  if (state.referenceFiles.length > 0) {
    html += `<div class="tree-item folder">📁 data/</div>`;
    html += `<div class="tree-item file" style="padding-left: 2.5rem;">📋 metadata.json</div>`;
    state.referenceFiles.forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      const icon = FILE_ICONS[ext] || FILE_ICONS.default;
      html += `<div class="tree-item file" style="padding-left: 2.5rem;">${icon} ${f.name}</div>`;
    });
  }

  html += `<div class="tree-item folder" style="color: var(--green);">🔐 solution/</div>`;
  html += `<div class="tree-item file" style="padding-left: 2.5rem; color: var(--green);">📋 metadata.json</div>`;
  state.solutionFiles.forEach(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    const icon = FILE_ICONS[ext] || FILE_ICONS.default;
    html += `<div class="tree-item file" style="padding-left: 2.5rem; color: var(--green);">${icon} ${f.name}</div>`;
  });

  html += '</div>';
  return html;
}

function generateTaskId() {
  const taskName = document.getElementById('taskName').value.trim();
  const hash = Math.random().toString(36).slice(2, 8);
  return `${hash}_${taskName}`;
}

// ============================================
// ZIP Generation & Download
// ============================================

function getFileCategory(extension) {
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(extension)) {
      return category;
    }
  }
  return 'other';
}

function getImageMetadata(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        resolution: `${img.naturalWidth}x${img.naturalHeight}`
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

function getAudioMetadata(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration_seconds: Math.round(audio.duration * 100) / 100,
        duration_formatted: formatDuration(audio.duration)
      });
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    audio.src = url;
  });
}

function getVideoMetadata(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        resolution: `${video.videoWidth}x${video.videoHeight}`,
        duration_seconds: Math.round(video.duration * 100) / 100,
        duration_formatted: formatDuration(video.duration)
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    video.src = url;
  });
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function generateFileMetadata(files) {
  const metadataPromises = files.map(async (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    const category = getFileCategory(extension);

    const baseMetadata = {
      name: file.name,
      size: file.size,
      extension: extension
    };

    // Get additional metadata based on file type
    let additionalMetadata = null;

    if (category === 'image') {
      additionalMetadata = await getImageMetadata(file);
    } else if (category === 'audio') {
      additionalMetadata = await getAudioMetadata(file);
    } else if (category === 'video') {
      additionalMetadata = await getVideoMetadata(file);
    }

    if (additionalMetadata) {
      return { ...baseMetadata, ...additionalMetadata };
    }

    return baseMetadata;
  });

  return Promise.all(metadataPromises);
}

async function saveToDatabase(taskId) {
  if (!API_CONFIG.enabled) {
    console.log('API calls disabled, skipping database save');
    return { success: true, skipped: true };
  }

  const taskName = document.getElementById('taskName').value.trim();
  const sector = document.getElementById('sector').value;
  const occupation = document.getElementById('occupation').value;
  const instruction = document.getElementById('instruction').value.trim();
  const difficulty = document.getElementById('difficulty').value;
  const expertTimeHours = parseFloat(document.getElementById('expertTime').value) || 0;
  const juniorTimeHours = parseFloat(document.getElementById('juniorTime').value) || 0;
  const rubrics = getRubricData();

  const [solutionMetadata, dataMetadata] = await Promise.all([
    generateFileMetadata(state.solutionFiles),
    generateFileMetadata(state.referenceFiles)
  ]);

  const payload = {
    task_id: taskId,
    task_name: taskName,
    sector: sector,
    occupation: occupation,
    instruction: instruction,
    difficulty: difficulty,
    expert_time_min: Math.round(expertTimeHours * 60),
    junior_time_min: Math.round(juniorTimeHours * 60),
    rubrics: rubrics.map(r => ({
      name: r.name,
      description: r.description || null,
      points: r.points
    })),
    solution_files: solutionMetadata,
    data_files: dataMetadata,
    task_yaml: generateTaskYaml(),
    solution_sh: generateSolutionSh()
  };

  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to save to database');
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    console.error('Database save error:', error);
    return { success: false, error: error.message };
  }
}

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

    // Add core files (only task.yaml and solution.sh)
    folder.file('task.yaml', generateTaskYaml());
    folder.file('solution.sh', generateSolutionSh());

    // Add data folder with reference files and metadata
    if (state.referenceFiles.length > 0) {
      const data = folder.folder('data');
      const dataMetadata = await generateFileMetadata(state.referenceFiles);
      data.file('metadata.json', JSON.stringify(dataMetadata, null, 2));
      for (const file of state.referenceFiles) {
        const content = await readFileAsArrayBuffer(file);
        data.file(file.name, content);
      }
    }

    // Add solution folder with solution files and metadata
    const solution = folder.folder('solution');
    const solutionMetadata = await generateFileMetadata(state.solutionFiles);
    solution.file('metadata.json', JSON.stringify(solutionMetadata, null, 2));
    for (const file of state.solutionFiles) {
      const content = await readFileAsArrayBuffer(file);
      solution.file(file.name, content);
    }

    // Generate ZIP
    const blob = await zip.generateAsync({ type: 'blob' });

    // Download ZIP
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${taskId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Save to database
    btn.innerHTML = '<span class="btn-icon">💾</span> Saving to database...';
    const dbResult = await saveToDatabase(taskId);

    // Close preview modal if open
    document.getElementById('previewModal').classList.remove('active');

    // Show success modal
    showSuccessModal(taskId, dbResult);

  } catch (error) {
    console.error('Generation error:', error);
    showToast('Error generating task package', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function showSuccessModal(taskId, dbResult) {
  const modal = document.getElementById('successModal');
  const taskIdDisplay = document.getElementById('successTaskId');
  const dbStatus = document.getElementById('dbStatus');

  taskIdDisplay.textContent = taskId;

  if (dbResult.skipped) {
    dbStatus.innerHTML = '<span style="color: var(--text-muted);">Database save skipped (API disabled)</span>';
  } else if (dbResult.success) {
    dbStatus.innerHTML = '<span style="color: var(--green);">Successfully saved to database</span>';
  } else {
    dbStatus.innerHTML = `<span style="color: var(--red);">Database save failed: ${dbResult.error}</span>`;
  }

  modal.classList.add('active');

  // Close button handler
  const closeBtn = document.getElementById('closeSuccessModal');
  const backdrop = modal.querySelector('.modal-backdrop');

  const closeHandler = () => {
    modal.classList.remove('active');
    closeBtn.removeEventListener('click', closeHandler);
    backdrop.removeEventListener('click', closeHandler);
  };

  closeBtn.addEventListener('click', closeHandler);
  backdrop.addEventListener('click', closeHandler);
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
