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
  initializeDifficultyToggle();
  initializeKeyboardShortcuts();
  initializeExamplesModal();
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
  let total = 7;

  // Task name
  const taskName = document.getElementById('taskName').value.trim();
  if (taskName && /^[a-z0-9-]+$/.test(taskName)) completed++;

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

  // Update progress text
  const progressText = document.getElementById('progressText');
  if (progressText) {
    progressText.textContent = `${progress}%`;
  }

  // Update rubric total
  updateRubricTotal();
}

function updateRubricTotal() {
  const rubrics = getRubricData();
  const total = rubrics.reduce((sum, r) => sum + r.points, 0);
  const totalEl = document.getElementById('rubricTotal');
  if (totalEl) {
    totalEl.textContent = total;
  }
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
  const difficulty = document.querySelector('input[name="difficulty"]:checked')?.value || 'medium';
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

  // Generate YAML (task_name not included - stored separately in DB)
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
set -e
mkdir -p /app/output
`;

  solutionFiles.forEach(file => {
    script += `cp /solution/${file} /app/output/\n`;
  });

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
  // Generate and cache task ID for consistency between preview and submit
  state.currentTaskId = generateTaskId();

  let html = `<div class="structure-tree">
    <div class="tree-item folder">📁 ${state.currentTaskId}/</div>
    <div class="tree-item file" style="padding-left: 1.5rem;">├── 📄 task.yaml</div>
    <div class="tree-item file" style="padding-left: 1.5rem;">├── 📄 solution.sh</div>`;

  if (state.referenceFiles.length > 0) {
    html += `<div class="tree-item folder" style="padding-left: 1.5rem;">├── 📁 data/</div>`;
    html += `<div class="tree-item file" style="padding-left: 3rem;">│   ├── 📋 metadata.json</div>`;
    state.referenceFiles.forEach((f, i) => {
      const ext = f.name.split('.').pop().toLowerCase();
      const icon = FILE_ICONS[ext] || FILE_ICONS.default;
      const prefix = i === state.referenceFiles.length - 1 ? '│   └──' : '│   ├──';
      html += `<div class="tree-item file" style="padding-left: 3rem;">${prefix} ${icon} ${f.name}</div>`;
    });
  }

  html += `<div class="tree-item folder" style="padding-left: 1.5rem; color: var(--green);">└── 🔐 solution/</div>`;
  html += `<div class="tree-item file" style="padding-left: 3rem; color: var(--green);">    ├── 📋 metadata.json</div>`;
  state.solutionFiles.forEach((f, i) => {
    const ext = f.name.split('.').pop().toLowerCase();
    const icon = FILE_ICONS[ext] || FILE_ICONS.default;
    const prefix = i === state.solutionFiles.length - 1 ? '    └──' : '    ├──';
    html += `<div class="tree-item file" style="padding-left: 3rem; color: var(--green);">${prefix} ${icon} ${f.name}</div>`;
  });

  html += '</div>';
  return html;
}

function generateTaskId() {
  const taskName = document.getElementById('taskName').value.trim();
  const hash = Math.random().toString(36).slice(2, 8);
  return `${hash}_${taskName}`;
}

function getOrCreateTaskId() {
  // Use cached ID if available (from preview), otherwise generate new one
  if (!state.currentTaskId) {
    state.currentTaskId = generateTaskId();
  }
  return state.currentTaskId;
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
  const difficulty = document.querySelector('input[name="difficulty"]:checked')?.value || 'medium';
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

  const btn = document.getElementById('submitBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="btn-icon">⏳</span> Generating...';
  btn.disabled = true;

  try {
    const zip = new JSZip();
    const taskId = getOrCreateTaskId();
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

    // Reset cached task ID for next submission
    state.currentTaskId = null;

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

// ============================================
// Difficulty Toggle
// ============================================

function initializeDifficultyToggle() {
  const difficultyInputs = document.querySelectorAll('input[name="difficulty"]');
  difficultyInputs.forEach(input => {
    input.addEventListener('change', updateProgress);
  });
}

// ============================================
// Keyboard Shortcuts
// ============================================

function initializeKeyboardShortcuts() {
  // Keyboard shortcut: Cmd/Ctrl + P for preview
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      if (validateForm()) {
        showPreview();
      }
    }
  });

  // Task name input - update progress on input
  const taskNameInput = document.getElementById('taskName');
  if (taskNameInput) {
    taskNameInput.addEventListener('input', updateProgress);
  }
}

// ============================================
// Reference Examples Modal
// ============================================

const SAMPLE_FILES = {
  '1-task-description': {
    name: 'SAMPLE-TASK.txt',
    content: `==========================================
  SAMPLE TASK DESCRIPTION
==========================================

Below is an example of how to fill out the task form fields.


TASK NAME:
----------
film-promo-reel-editing

  - Use lowercase letters only
  - Use hyphens instead of spaces
  - Keep it short but descriptive
  - Examples: "contract-review", "patient-triage", "invoice-processing"


SECTOR:
-------
Arts, Entertainment, and Recreation

  - Choose the industry this task belongs to
  - Pick from the dropdown options


OCCUPATION:
-----------
Film and Video Editors

  - Choose the job role that would do this task
  - Pick from the dropdown options


DIFFICULTY:
-----------
Hard

  - Medium: Complex tasks requiring expertise (7-15 hours for an expert)
  - Hard: Very complex, requires deep expertise (15+ hours for an expert)

  NOTE: All tasks must take at least 7 hours for an expert to complete.
        Simple or quick tasks are not accepted.


TASK DESCRIPTION:
-----------------

*** IMPORTANT: YOUR TASK DESCRIPTION MUST BE 100% HANDWRITTEN ***
*** AI-GENERATED DESCRIPTIONS ARE NOT ALLOWED AND WILL BE REJECTED ***

Write a clear, detailed description of what the AI needs to do.
Include:

1. CONTEXT - Who is the AI acting as?
   "You are a Film and Video Editor specializing in social media content..."

2. INPUT DATA - What files will the AI use?
   "You are given raw video clips, audio tracks, and fonts..."

3. REQUIRED OUTPUT - What should the AI produce?
   "Create two PSA videos - one vertical (9:16) and one horizontal (16:9)..."

4. SPECIFIC REQUIREMENTS - Any rules or constraints?
   "Use FFmpeg for processing, include text overlays, H.264 codec..."


EXAMPLE DESCRIPTION (Film Promo Reel Editing):
----------------------------------------------
You are a Film and Video Editor specializing in social media content.
A nonprofit organization needs viral social awareness videos for their
"Disconnect to Connect" campaign about digital wellness and reducing
screen time.

Your task is to create two engaging, impactful PSA videos:
- One vertical (9:16) for mobile social media platforms
- One horizontal (16:9) for web and presentations

## Required Deliverables

1. viral_vertical.mp4 - Vertical format video:
   - Resolution: 1080x1920 (9:16 aspect ratio)
   - Duration: 15-30 seconds
   - Must include trending-style editing

2. viral_horizontal.mp4 - Horizontal format video:
   - Resolution: 1920x1080 (16:9 aspect ratio)
   - Duration: 30-60 seconds

3. thumbnail_horizontal.png - Web thumbnail (1280x720)

## Technical Requirements

- Use FFmpeg for video processing
- Vertical: H.264, CRF 20, max 50MB file size
- Horizontal: H.264, CRF 18, max 100MB file size
- Audio: AAC
- Include text overlays that communicate message without sound


==========================================
  HOW TO WRITE A GOOD TASK DESCRIPTION
==========================================

*** REMEMBER: WRITE EVERYTHING BY HAND - NO AI GENERATION ***

1. BE SPECIFIC - Include exact specs, formats, dimensions
2. DEFINE THE ROLE - Who is the AI acting as?
3. LIST EXACT OUTPUTS - What files should be created?
4. SET CLEAR CONSTRAINTS - Technical requirements
5. MAKE IT COMPLEX ENOUGH - Must require 7+ hours for an expert`
  },
  '2-reference-files': {
    name: 'README.txt',
    content: `==========================================
  REFERENCE FILES - WHAT TO UPLOAD
==========================================

Reference files are the INPUT data that the AI will use to
complete the task. These are the files the AI can see and work with.


*** IMPORTANT: USE PUBLIC DOMAIN DATA ONLY ***

Do NOT create synthetic/fake data. Use real, publicly available
datasets and files. Examples of public domain sources:

- Pexels.com (free stock videos/images)
- Pixabay.com (free stock media)
- Archive.org (public domain content)
- Kaggle.com (public datasets)
- Government open data portals
- Creative Commons licensed content


WHAT TO INCLUDE:
----------------

Upload any files the AI needs to do the task:

- Documents: PDF, DOCX, TXT files
- Data: CSV, JSON, XLSX spreadsheets
- Images: PNG, JPG (for image-related tasks)
- Audio: MP3, WAV (for audio/transcription tasks)
- Video: MP4, MOV (for video editing tasks)


EXAMPLE FOR THE FILM PROMO REEL TASK:
-------------------------------------

For the "film-promo-reel-editing" task, you would upload:

1. raw_clips/ folder with video clips:
   - people_on_phones.mp4 (from Pexels)
   - nature_scenery.mp4 (from Pexels)
   - family_moments.mp4 (from Pexels)

2. audio/ folder:
   - emotional_music.mp3 (royalty-free from Pixabay)
   - notification_sound.mp3 (Creative Commons)

3. fonts/ folder:
   - Montserrat-Bold.ttf (Google Fonts - open source)


WHERE TO FIND PUBLIC DOMAIN CONTENT:
------------------------------------

VIDEO:  pexels.com/videos, pixabay.com/videos
AUDIO:  pixabay.com/music, freesound.org
IMAGES: unsplash.com, pexels.com, pixabay.com
DATA:   kaggle.com/datasets, data.gov
FONTS:  fonts.google.com, fontsquirrel.com


TIPS:
-----

1. USE PUBLIC DOMAIN SOURCES ONLY
2. INCLUDE ALL FILES MENTIONED IN YOUR TASK
3. ORGANIZE WITH FOLDERS (raw_clips/, audio/, fonts/)
4. NAME FILES CLEARLY
5. TEST YOUR FILES BEFORE UPLOADING`
  },
  '3-solution-files': {
    name: 'README.txt',
    content: `==========================================
  SOLUTION FILES - WHAT TO UPLOAD
==========================================

Solution files are the CORRECT ANSWERS - what the AI should produce
if it does the task perfectly. These files are hidden from the AI
and used to check if the AI got it right.


WHAT TO INCLUDE:
----------------

Upload the expected output for the task:

- If task asks for videos → upload the correct videos
- If task asks for a report → upload the correct report
- If task asks for analysis → upload the correct analysis
- If task asks for edited files → upload the correctly edited versions


EXAMPLE FOR THE FILM PROMO REEL TASK:
-------------------------------------

For the "film-promo-reel-editing" task, you would upload:

1. viral_vertical.mp4
   - The correctly edited vertical video (1080x1920)
   - 15-30 seconds, with all required elements
   - This is what a perfect submission looks like

2. viral_horizontal.mp4
   - The correctly edited horizontal video (1920x1080)
   - 30-60 seconds, with storytelling elements

3. thumbnail_horizontal.png
   - The correct thumbnail image (1280x720)


TIPS:
-----

1. CREATE THE SOLUTION YOURSELF FIRST
   Actually do the task manually to create the correct answer.
   For a 7+ hour task, this means spending 7+ hours yourself.

2. BE PRECISE
   The solution should meet all the requirements you specified.

3. MATCH YOUR TASK REQUIREMENTS
   If your task says "create H.264 video at CRF 20", your
   solution must be H.264 at CRF 20.

4. INCLUDE ALL REQUIRED OUTPUTS
   If your task asks for 3 deliverables, include all 3 files.

5. QUALITY MATTERS
   Your solution sets the standard. Make it professional.`
  },
  '4-rubrics': {
    name: 'SAMPLE-RUBRICS.txt',
    content: `==========================================
  SAMPLE RUBRICS
==========================================

Rubrics define HOW to score the AI's work. Each rubric is a
criteria with a point value.


EXAMPLE RUBRICS FOR FILM PROMO REEL TASK:
-----------------------------------------

1. HOOK EFFECTIVENESS (0-5 points)
   - 5 pts: Instantly thought-provoking, impossible to scroll past
   - 4 pts: Strong hook that captures attention within 2 seconds
   - 3 pts: Decent opening but could be stronger
   - 2 pts: Slow start, might lose viewers
   - 1 pt:  No clear hook
   - 0 pts: Boring or confusing opening

2. EMOTIONAL IMPACT (0-5 points)
   - 5 pts: Deeply moving, creates genuine emotional response
   - 4 pts: Strong emotional resonance, memorable
   - 3 pts: Somewhat impactful, decent emotional arc
   - 2 pts: Tries to be emotional but falls flat
   - 1 pt:  No emotional connection
   - 0 pts: Off-putting or tone-deaf

3. EDITING STYLE (0-5 points)
   - 5 pts: Perfect modern editing (pacing, effects, transitions)
   - 4 pts: Good use of editing techniques
   - 3 pts: Competent editing but not exceptional
   - 2 pts: Editing feels awkward or distracting
   - 1 pt:  Poor editing choices
   - 0 pts: Amateur or broken editing

4. DUAL FORMAT EXECUTION (0-4 points)
   - 4 pts: Both formats excellent, properly optimized
   - 3 pts: Both formats good, minor issues
   - 2 pts: One format good, one weak
   - 1 pt:  Both formats have significant issues
   - 0 pts: Missing format or completely wrong specs

5. MESSAGE CLARITY & CTA (0-3 points)
   - 3 pts: Clear message, memorable CTA, hashtag visible
   - 2 pts: Message present but could be clearer
   - 1 pt:  Weak or confusing message/CTA
   - 0 pts: No clear message or CTA

6. TECHNICAL QUALITY (0-3 points)
   - 3 pts: Perfect specs, clean exports, proper audio
   - 2 pts: Minor technical issues
   - 1 pt:  Noticeable technical problems
   - 0 pts: Wrong specs or corrupted files

TOTAL: 25 points
PASSING SCORE: 18 points (72%)


==========================================
  HOW TO WRITE GOOD RUBRICS
==========================================

1. BE OBJECTIVE
   Bad:  "Video looks good" (subjective)
   Good: "Video includes text overlay in first 2 seconds"

2. USE MEASURABLE CRITERIA
   Bad:  "Editing is mostly right"
   Good: "Resolution is exactly 1080x1920"

3. ASSIGN FAIR POINT VALUES
   - Critical requirements: 4-5 points
   - Important but flexible: 2-3 points
   - Nice-to-haves: 1-2 points

4. COVER ALL REQUIREMENTS
   Each requirement should have a rubric.

5. INCLUDE PARTIAL CREDIT
   Allow partial points for partially correct answers.`
  }
};

function initializeExamplesModal() {
  const modal = document.getElementById('examplesModal');
  const openBtn = document.getElementById('viewExamplesBtn');
  const closeBtn = document.getElementById('closeExamplesModal');
  const closeBtn2 = document.getElementById('closeExamplesBtn');
  const treeItems = document.querySelectorAll('.tree-item.file');
  const fileContent = document.getElementById('fileContent');
  const filePath = document.getElementById('currentFilePath');

  // Open modal
  openBtn?.addEventListener('click', () => {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  // Close modal
  const closeModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeModal);
  closeBtn2?.addEventListener('click', closeModal);

  // Close on overlay click
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // File tree navigation
  treeItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active from all
      treeItems.forEach(i => i.classList.remove('active'));
      // Add active to clicked
      item.classList.add('active');

      // Get folder and load content
      const folder = item.dataset.folder;
      if (folder && SAMPLE_FILES[folder]) {
        const file = SAMPLE_FILES[folder];
        filePath.textContent = 'samples/' + folder + '/' + file.name;
        fileContent.textContent = file.content;
      }
    });
  });
}
