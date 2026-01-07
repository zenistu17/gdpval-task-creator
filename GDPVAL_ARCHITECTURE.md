# GDPVal Complete System Architecture (Updated Jan 7, 2026)

## ⚠️ CRITICAL: READ THIS FIRST

**This document contains EXACT specifications that must be followed.**
Missing any detail here will cause runtime failures.

**Last Major Update**: January 7, 2026 - Updated validation rules (analytic rubric), fixed file naming, added My Tasks page, pipeline/terminal_bench docs

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Repository Structure](#repository-structure)
4. [Authentication System](#authentication-system-critical)
5. [User Management & Permissions](#user-management--permissions)
6. [Frontend Components](#frontend-components)
7. [Backend API](#backend-api)
8. [Database Schema](#database-schema)
9. [Pipeline & Worker](#pipeline--worker)
10. [Common Gotchas & Pitfalls](#common-gotchas--pitfalls)
11. [Testing Checklist](#testing-checklist)

---

## System Overview

GDPVal is a complete task creation and evaluation system with **two separate backends**:

### 1. **GDPVAL Repo** (NEW - Primary for task creation frontend)
- **Repository**: https://github.com/Parsewave-internal/GDPVAL
- **Purpose**: Frontend hosting + Task submission API + Authentication
- **Stack**: Python FastAPI + DynamoDB + GitHub
- **Deployed**: https://gdpval.parsewave.ai/

### 2. **Admin Repo** (Legacy - Still used for backend processing)
- **Repository**: https://github.com/Parsewave-internal/admin
- **Purpose**: Task queue management + Worker backend
- **Stack**: Node.js Express + PostgreSQL

### **How They Work Together**:
```
User → GDPVAL Frontend (gdpval.parsewave.ai)
         ↓ Auth via DynamoDB
         ↓ Task submission to FastAPI
         ↓ Stored in DynamoDB
         ↓ Also synced to PostgreSQL (admin repo)
         ↓ Worker polls PostgreSQL
         ↓ Processes task → GitHub PR
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER (Browser)                                │
│  https://gdpval.parsewave.ai/gdpval-task.html                    │
└─────────────────────────────────────────────────────────────────┘
                               │
           ┌───────────────────┴───────────────────┐
           │                                       │
           ▼                                       ▼
┌────────────────────────┐             ┌────────────────────────┐
│  Authentication Flow   │             │   Task Creation Flow   │
└────────────────────────┘             └────────────────────────┘
           │                                       │
           ▼                                       ▼
   POST /api/login                     POST /api/gdpval/tasks
   (username + password)                (task data + files)
           │                                       │
           ▼                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              GDPVAL BACKEND (FastAPI)                            │
│  Repo: https://github.com/Parsewave-internal/GDPVAL             │
│  Server: gdpval3 (or load-balanced)                             │
│                                                                  │
│  Key Files:                                                      │
│  - backend/api_server.py (Main FastAPI app)                     │
│  - backend/create_auth_tables.py (DynamoDB setup)               │
│  - frontend/ (HTML/CSS/JS files)                                │
└─────────────────────────────────────────────────────────────────┘
           │                                       │
           ▼                                       ▼
   ┌──────────────┐                      ┌──────────────┐
   │  DynamoDB    │                      │  DynamoDB    │
   │              │                      │              │
   │ GDPValUsers  │                      │ GDPValTasks  │
   │ (user_id PK) │                      │ (task_id PK) │
   │              │                      │              │
   │ GDPValSessions│                     │              │
   │ (session_id) │                      │              │
   └──────────────┘                      └──────────────┘
           │
           │ User authenticated → Session created
           │
           ▼
   Browser gets httpOnly cookie
   (gdpval_session=<token>)
           │
           │ All future requests include cookie
           │
           ▼
   Frontend calls APIs with credentials: 'include'

┌─────────────────────────────────────────────────────────────────┐
│              WORKER BACKEND (Node.js Express)                    │
│  Repo: https://github.com/Parsewave-internal/admin              │
│  Purpose: Task processing queue                                 │
│                                                                  │
│  Worker polls DynamoDB → Processes tasks → Creates GitHub PRs   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

### GDPVAL Repo (Primary)

```
https://github.com/Parsewave-internal/GDPVAL
├── backend/
│   ├── api_server.py              ← Main FastAPI app (AUTH + TASKS)
│   ├── create_auth_tables.py      ← DynamoDB setup script
│   ├── add_user_id_gsi.py         ← Add GSI for user_id lookups
│   ├── email_service.py           ← Email verification/reset service
│   └── validators.py              ← Task validation logic
│
├── frontend/
│   ├── gdpval-task.html           ← Task creator (ALL users)
│   ├── gdpval-queue.html          ← Queue viewer (DEV/ADMIN only)
│   ├── gdpval-review.html         ← Reviewer dashboard (DEV/ADMIN only)
│   ├── gdpval-my-tasks.html       ← User's own tasks (ALL users)
│   ├── gdpval-users.html          ← User management (DEV/ADMIN only)
│   ├── gdpval-login.html          ← Login page
│   ├── verify-email.html          ← Email verification page
│   ├── reset-password.html        ← Password reset page
│   ├── config.js                  ← Backend URL configuration
│   └── gdpval/
│       ├── auth.js                ← Auth state management
│       ├── auth-ui.js             ← Login modal
│       ├── sidebar.js             ← Navigation (role-based filtering)
│       ├── sidebar.css
│       ├── script.js              ← Task creator logic
│       ├── queue-script.js        ← Queue viewer logic
│       ├── review-script.js       ← Reviewer dashboard logic
│       ├── review-style.css       ← Reviewer dashboard styles
│       ├── my-tasks-script.js     ← My tasks page logic
│       └── my-tasks-style.css     ← My tasks page styles
│
├── pipeline/                      ← Python task processing & terminal_bench
│   ├── scripts/
│   │   ├── task_submit.py         ← Task submission to GitHub/DynamoDB
│   │   ├── task_registry.py       ← DynamoDB task management
│   │   ├── ai_detector.py         ← AI-generated content detection
│   │   ├── bullshit_detector.py   ← Content quality checks
│   │   ├── oracle_runner.py       ← Oracle test execution
│   │   └── gdpval_worker.py       ← Background task processor
│   └── terminal_bench/            ← Agent testing framework
│       ├── agents/                ← AI agent implementations
│       ├── dataset/               ← Task dataset management
│       ├── cli/                   ← Command-line tools
│       └── harness/               ← Test harness
│
└── run-server.sh                  ← Server startup script
```

**Deployment**:
- Frontend served from `/frontend/` directory
- URLs:
  - `https://gdpval.parsewave.ai/gdpval-task.html`
  - `https://gdpval.parsewave.ai/gdpval-queue.html`
  - `https://gdpval.parsewave.ai/gdpval-review` (reviewer dashboard)
  - `https://gdpval.parsewave.ai/gdpval-my-tasks.html`
  - `https://gdpval.parsewave.ai/gdpval-users.html`

---

## Authentication System (CRITICAL!)

### Overview

**Type**: Session-based authentication with httpOnly cookies
**Storage**: DynamoDB (NOT PostgreSQL)
**Session Duration**: 24 hours with TTL auto-expiry

### Database Tables

#### GDPValUsers
```
Primary Key: user_id (String)
Attributes:
  - user_id: "usr_<12 hex chars>" (e.g., "usr_a1b2c3d4e5f6")
  - username: String (login name)
  - password_hash: String (SHA-256, TODO: upgrade to bcrypt)
  - role: "dev" | "admin" | "contributor"
  - created_at: ISO timestamp

Global Secondary Index: username-index
  - Key: username
  - Projection: ALL
  - Purpose: Login lookups
```

#### GDPValSessions
```
Primary Key: session_id (String)
Attributes:
  - session_id: Random token (secrets.token_urlsafe(32))
  - user_id: References GDPValUsers.user_id
  - created_at: ISO timestamp
  - expires_at: ISO timestamp
  - ttl: Unix timestamp (DynamoDB TTL auto-cleanup)
```

### Authentication Flow

#### 1. Login Request

**Frontend Code** (`auth-ui.js:459`):
```javascript
const response = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },  // ← MUST BE JSON
  body: JSON.stringify({ username, password }),
  credentials: 'include'  // ← REQUIRED for cookies
});
```

**Backend Endpoint** (`api_server.py:453`):
```python
class LoginRequest(BaseModel):  # ← Pydantic model, NOT Form(...)
    username: str
    password: str

@app.post("/api/login")
async def login(
    response: Response,
    request: LoginRequest  # ← JSON body
):
    # 1. Verify password and get user_id
    user_id = verify_password(request.username, request.password)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 2. Create session in DynamoDB
    session_id = create_session(user_id)

    # 3. Get user details for response
    user = get_user_by_id(user_id)
    role = user.get("role", "contributor") if user else "contributor"

    # 4. Set httpOnly cookie
    response.set_cookie(
        key="gdpval_session",
        value=session_id,
        httponly=True,
        secure=False,  # TODO: True in production with HTTPS
        samesite="lax",
        max_age=24 * 3600  # 24 hours
    )

    # 5. Return user info
    return {
        "authenticated": True,  # ← Frontend checks this
        "user": {              # ← Frontend checks this
            "user_id": user_id,
            "username": request.username,
            "role": role
        }
    }
```

**CRITICAL Response Format**:
```json
{
  "authenticated": true,
  "user": {
    "user_id": "usr_a1b2c3d4e5f6",
    "username": "admin",
    "role": "dev"
  }
}
```

**Frontend Updates State** (`auth-ui.js:461`):
```javascript
if (data.authenticated) {
  parseAuth.currentUserId = data.user.user_id;    // ← Store user_id
  parseAuth.currentUsername = data.user.username;
  parseAuth.isSessionAuth = true;
}
```

#### 2. Get User Info

**Frontend** (all pages on load):
```javascript
const response = await fetch('/api/user', {
  credentials: 'include'  // ← Send session cookie
});
```

**Backend** (`api_server.py:414`):
```python
@app.get("/api/user")
async def get_user_info(user_id: Optional[str] = Depends(get_current_user)):
    if not user_id:
        return {"authenticated": False, "user": None}

    user = get_user_by_id(user_id)
    if not user:
        return {"authenticated": False, "user": None}

    role = user.get("role", "contributor")
    permissions = {
        "can_create_tasks": True,
        "can_view_queue": role in ["dev", "admin"],
        "can_manage_users": role in ["dev", "admin"]
    }

    return {
        "authenticated": True,
        "user": {
            "user_id": user_id,
            "username": user.get("username", ""),
            "authMethod": "session",
            "role": role,
            "permissions": permissions
        }
    }
```

**Response Format**:
```json
{
  "authenticated": true,
  "user": {
    "user_id": "usr_a1b2c3d4e5f6",
    "username": "admin",
    "authMethod": "session",
    "role": "dev",
    "permissions": {
      "can_create_tasks": true,
      "can_view_queue": true,
      "can_manage_users": true
    }
  }
}
```

#### 3. Logout

**Frontend** (`auth.js:110`):
```javascript
async logout() {
  // Call backend to destroy session
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'include'
  });

  // Clear local state
  this.currentUserId = null;
  this.currentUsername = null;
  this.isSessionAuth = false;

  // Reload page
  window.location.reload();
}
```

**Backend** (`api_server.py:487`):
```python
@app.post("/api/logout")
async def logout(
    response: Response,
    session_id: Optional[str] = Cookie(None, alias="gdpval_session")
):
    if session_id:
        delete_session(session_id)  # Delete from DynamoDB

    response.delete_cookie(key="gdpval_session")
    return {"success": True}
```

**ALSO need GET /logout** for redirect (`api_server.py:511`):
```python
@app.get("/logout")
async def logout_redirect(session_id: Optional[str] = Cookie(...)):
    from fastapi.responses import RedirectResponse

    if session_id:
        delete_session(session_id)

    response = RedirectResponse(url="/", status_code=302)
    response.delete_cookie(key="gdpval_session")
    return response
```

#### 4. Auth Middleware

**Backend** (`api_server.py:188`):
```python
def get_current_user(
    session_id: Optional[str] = Cookie(None, alias="gdpval_session")
) -> Optional[str]:
    """Returns user_id from session cookie"""
    if not session_id:
        return None

    session = get_session(session_id)
    if not session:
        return None

    return session["user_id"]  # ← Returns user_id, NOT username

def require_auth(user_id: Optional[str] = Depends(get_current_user)) -> str:
    """Requires authentication, returns user_id"""
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id

def require_dev_role(user_id: str = Depends(require_auth)) -> str:
    """Requires dev/admin role, returns user_id"""
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    role = user.get("role", "contributor")
    if role not in ["dev", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return user_id
```

#### 5. Required Stub Endpoint

**Frontend checks token status** - must return healthy response:

```python
@app.get("/api/token-status")
async def get_token_status():
    """Stub for frontend GitHub API rate limit check"""
    return {
        "remaining": 5000,
        "limit": 5000,
        "reset": None,
        "status": "healthy"
    }
```

### Default Users

After running `backend/create_auth_tables.py`:

| Username | Password  | user_id         | Role        | Access                            |
|----------|-----------|-----------------|-------------|-----------------------------------|
| admin    | admin123  | usr_admin_001   | dev         | All pages + user management       |
| test     | test123   | usr_test_001    | contributor | Task creation only                |

---

## User Management & Permissions

### Permission Matrix

| Role         | Task Creator | My Tasks | Queue Viewer | Reviewer | User Management |
|--------------|-------------|----------|--------------|----------|-----------------|
| **Contributor** | ✅          | ✅       | ❌           | ❌       | ❌              |
| **Dev**         | ✅          | ✅       | ✅           | ✅       | ✅              |
| **Admin**       | ✅          | ✅       | ✅           | ✅       | ✅              |

### User Management API

#### Create User

**Endpoint**: `POST /api/gdpval/users`
**Auth**: Dev/admin only
**Body**:
```json
{
  "username": "newuser",
  "password": "password123",
  "role": "contributor"
}
```

**Response**:
```json
{
  "success": true,
  "user_id": "usr_c3d4e5f6a7b8",
  "username": "newuser",
  "role": "contributor"
}
```

**Backend** (`api_server.py:511`):
```python
@app.post("/api/gdpval/users")
async def create_user_endpoint(
    request: CreateUserRequest,
    current_user_id: str = Depends(require_dev_role)  # ← Dev/admin check
):
    user_id = create_user(request.username, request.password, request.role)
    return {
        "success": True,
        "user_id": user_id,
        "username": request.username,
        "role": request.role
    }
```

#### List Users

**Endpoint**: `GET /api/gdpval/users`
**Auth**: Dev/admin only

**Response**:
```json
{
  "users": [
    {
      "user_id": "usr_admin_001",
      "username": "admin",
      "role": "dev",
      "created_at": "2026-01-01T00:00:00Z"
    },
    ...
  ]
}
```

#### Get User Permissions

**Endpoint**: `GET /api/gdpval/users/{user_id}/permissions`
**Auth**: Any authenticated user

**Response**:
```json
{
  "user_id": "usr_test_001",
  "username": "test",
  "role": "contributor",
  "permissions": {
    "can_create_tasks": true,
    "can_view_queue": false,
    "can_manage_users": false
  }
}
```

#### Delete User

**Endpoint**: `DELETE /api/gdpval/users/{user_id}`
**Auth**: Dev/admin only
**Cannot delete yourself**

**Response**:
```json
{
  "success": true,
  "message": "User test (usr_test_001) deleted"
}
```

### Frontend Permission Checks

#### Queue Page (`gdpval-queue.html:265`)

```javascript
window.addEventListener('load', async () => {
  const currentUserId = window.parseAuth?.currentUserId;  // ← Note: parseAuth, not auth
  if (!currentUserId) {
    alert('Please log in to access the queue.');
    window.location.href = '/gdpval-task.html';
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/users/${currentUserId}/permissions`,
      { credentials: 'include' }  // ← REQUIRED
    );
    const data = await response.json();

    if (!data.permissions.can_view_queue) {
      alert('Access denied. Only devs/admins can access the queue.');
      window.location.href = '/gdpval-task.html';
      return;
    }
  } catch (err) {
    console.error('Permission check failed:', err);
  }
});
```

#### User Management Page (`gdpval-users.html:359`)

```javascript
async function checkPermissions() {
  const currentUserId = window.parseAuth?.currentUserId;  // ← parseAuth!
  if (!currentUserId) {
    return false;
  }

  const response = await fetch(
    `${API_URL}/users/${currentUserId}/permissions`,
    { credentials: 'include' }
  );
  const data = await response.json();

  if (data.role !== 'admin' && data.role !== 'dev') {
    alert('Access denied. Only admins/devs can access user management.');
    window.location.href = '/gdpval-task.html';
    return false;
  }

  return true;
}

// Initialize AFTER auth
window.addEventListener('load', async () => {
  await authUI.init({
    onAuthenticated: async () => {
      if (await checkPermissions()) {
        loadUsers();
      }
    }
  });
});
```

### Sidebar Filtering (`sidebar.js`)

```javascript
function filterMenuItems(permissions) {
  // Handle GDPVal permission system (object with boolean flags)
  if (typeof permissions === 'object' && !Array.isArray(permissions)) {
    const allowed = new Set();

    if (permissions.can_create_tasks) {
      allowed.add('/gdpval-task');
      allowed.add('/gdpval-my-tasks');  // All users can see their own tasks
    }

    if (permissions.can_view_queue) {
      allowed.add('/gdpval-queue');
      allowed.add('/gdpval-review');  // Reviewer dashboard
    }

    if (permissions.can_manage_users) {
      allowed.add('/gdpval-users');
    }

    // Filter menu to only show allowed pages
    return menuItems.map(section => ({
      section: section.section,
      items: section.items.filter(item => allowed.has(item.href))
    })).filter(section => section.items.length > 0);
  }

  // ... legacy admin permission system
}
```

---

## Frontend Components

### Page Initialization Pattern

**CRITICAL**: All pages must wait for authentication before initializing:

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for auth to complete
  await authUI.init({
    onAuthenticated: () => {
      // ONLY initialize page components after auth succeeds
      initializePageComponents();
    }
  });
});
```

**Example** (`script.js:261`):
```javascript
function initializePageComponents() {
  initializeSectorDropdown();
  initializeOccupationDropdown();
  initializeTextarea();
  initializeFileUploads();
  // ... rest of initialization
}

document.addEventListener('DOMContentLoaded', async () => {
  await authUI.init({
    onAuthenticated: () => {
      initializePageComponents();
    }
  });
});
```

### Config.js Backend URL

**Development** (`frontend/config.js:10`):
```javascript
window.GDPVAL_CONFIG = {
  BACKEND_API_URL: 'http://localhost:8000',  // For local testing
  API_PREFIX: '/api/gdpval',
  get API_BASE_URL() {
    return this.BACKEND_API_URL + this.API_PREFIX;
  }
};
```

**Production**:
```javascript
window.GDPVAL_CONFIG = {
  BACKEND_API_URL: window.location.origin,  // Same domain
  // ...
};
```

### Auth Object Reference

**CRITICAL**: The global auth object is `parseAuth`, NOT `auth`:

```javascript
// ✅ CORRECT
window.parseAuth.currentUserId
window.parseAuth.currentUsername
window.parseAuth.logout()

// ❌ WRONG
window.auth.currentUserId  // undefined!
```

### Fetch with Credentials

**ALL API calls must include `credentials: 'include'`:**

```javascript
// ✅ CORRECT
await fetch('/api/gdpval/users', {
  credentials: 'include'
});

// ❌ WRONG - cookies won't be sent
await fetch('/api/gdpval/users');
```

---

## Backend API

### Task Submission

**Endpoint**: `POST /api/gdpval/tasks`
**Auth**: Required (any role)

**Request**:
```json
{
  "task_id": "abc123",
  "task_name": "Financial Report Analysis",
  "sector": "Finance and Insurance",
  "occupation": "Financial Analysts",
  "instruction": "Analyze the quarterly report...",
  "difficulty": "medium",
  "expert_time_min": 60,
  "rubrics": [
    {
      "name": "Accuracy",
      "description": "Correct financial calculations",
      "points": 10
    }
  ],
  "reference_files": [...],
  "solution_files": [...],
  "sources": []
}
```

**Backend** (`api_server.py:591`):
```python
@app.post("/api/gdpval/tasks", response_model=TaskResponse)
async def create_task(
    user_id: str = Depends(require_auth),  # ← User must be authenticated
    task_id: str = Form(...),
    task_name: str = Form(...),
    # ... other fields
):
    # Submit to DynamoDB
    result = submit_task(
        task_id=task_id,
        task_name=task_name,
        # ...
    )

    return TaskResponse(
        task_id=result["task_id"],
        status=result["status"],
        pr_url=result.get("pr_url"),
        # ...
    )
```

### DynamoDB Schema

#### GDPValTasks Table
```
Primary Key: task_id (String)
Attributes:
  - task_id: Unique identifier
  - task_name: Human-readable name
  - sector: BLS sector
  - occupation: BLS occupation
  - instruction: Task description (TEXT)
  - difficulty: "easy" | "medium" | "hard"
  - expert_time_min: Expected time in minutes
  - status: "pending" | "processing" | "completed" | "failed"
  - pr_url: GitHub PR URL (once created)
  - created_at: ISO timestamp
  - updated_at: ISO timestamp
  - created_by: user_id who created it
```

---

## Payment Info Collection System

**Added**: January 4, 2026
**Purpose**: Collect contributor payment information before task submission

### Overview

All contributors must provide payment information before submitting tasks. This enables automated payments for completed work. The system supports three payment methods:
- **Wise**: International money transfers via Wise ID
- **Crypto**: USDC payments on Solana or Ethereum (ERC-20)
- **SWIFT**: Direct bank transfers via SWIFT/IBAN

### Architecture Flow

```
User fills task form
       ↓
Clicks "Generate & Download"
       ↓
Check payment info exists (GET /api/service/contributor-payment-info/:username)
       ↓
    No info? → Show payment modal (closable, preserves form data)
       ↓          ↓
    Has info?  User fills payment info → POST /api/service/contributor-payment-info/:username
       ↓          ↓
       ↓       Success → Close modal → Auto-retry task submission
       ↓
Submit task normally
```

### Frontend Implementation

#### Payment Check Before Submission (`script.js:2716`)

```javascript
async function generateAndDownload() {
  if (!validateForm()) return;

  // Check if user has payment info before allowing task creation
  const hasPaymentInfo = await checkPaymentInfo();
  if (!hasPaymentInfo) {
    showPaymentInfoModal();
    return;  // Block task submission until payment info provided
  }

  // Continue with task creation...
}

async function checkPaymentInfo() {
  try {
    const userResponse = await fetch('/api/user', { credentials: 'include' });
    if (!userResponse.ok) return false;

    const userData = await userResponse.json();
    const username = userData.user?.username;
    if (!username) return false;

    // Call admin service API to check payment info
    const response = await fetch(
      `https://admin.parsewave.ai/api/service/contributor-payment-info/${username}`,
      {
        headers: {
          'X-Service-Key': 'dd4f22fe-1bab-4bda-8a2e-4586e2b4afc7'
        }
      }
    );

    if (!response.ok) return false;

    const data = await response.json();
    return data.hasPaymentInfo === true;
  } catch (err) {
    console.error('Error checking payment info:', err);
    return false;
  }
}
```

#### Payment Info Modal (`gdpval-task.html:441`)

**Key Features**:
- ✅ Closable (X button + backdrop click)
- ✅ Preserves task form data when closed
- ✅ Shows helpful toast: "You can submit your task after setting up payment info"
- ✅ Auto-retries task submission after successful save

**HTML Structure**:
```html
<div class="modal" id="paymentInfoModal">
  <div class="modal-backdrop" id="paymentModalBackdrop"></div>
  <div class="modal-content">
    <div class="modal-header">
      <h2>Payment Information Required</h2>
      <button type="button" class="close-btn" id="closePaymentModal">&times;</button>
    </div>

    <!-- Email (required for all methods) -->
    <input type="email" id="standalonePaymentEmail" required>

    <!-- Payment method selector -->
    <select id="standalonePaymentMethod" required>
      <option value="">Select payment method...</option>
      <option value="wise">Wise</option>
      <option value="crypto">Crypto</option>
      <option value="swift">SWIFT</option>
    </select>

    <!-- Wise Fields (shown when method=wise) -->
    <div id="standaloneWiseFields" style="display: none;">
      <input type="text" id="standaloneWiseId" placeholder="@username or email">
    </div>

    <!-- Crypto Fields (shown when method=crypto) -->
    <div id="standaloneCryptoFields" style="display: none;">
      <select id="standaloneCryptoNetwork">
        <option value="erc20">Ethereum (ERC-20)</option>
        <option value="solana">Solana</option>
      </select>
      <input type="text" id="standaloneCryptoAddress" placeholder="0x... or base58 address">
    </div>

    <!-- SWIFT Fields (shown when method=swift) -->
    <div id="standaloneSwiftFields" style="display: none;">
      <input type="text" id="standaloneSwiftAccountHolder" placeholder="John Doe">
      <input type="text" id="standaloneSwiftBic" placeholder="DEUTDEFF">
      <input type="text" id="standaloneSwiftAccountNumber" placeholder="DE89370400440532013000">
      <input type="text" id="standaloneSwiftCountry" placeholder="DE">
      <input type="text" id="standaloneSwiftCity" placeholder="Berlin">
      <input type="text" id="standaloneSwiftAddress" placeholder="123 Main St">
      <input type="text" id="standaloneSwiftPostCode" placeholder="10115">
      <input type="text" id="standaloneSwiftState" placeholder="Berlin">
    </div>

    <button id="standaloneSubmitPayment">Submit Payment Info</button>
  </div>
</div>
```

#### Payment Method Validation (`script.js:2814`)

```javascript
// Wise validation
if (paymentMethod === 'wise') {
  const wiseId = document.getElementById('standaloneWiseId').value.trim();
  if (!wiseId) {
    showToast('Please enter Wise ID', 'error');
    return;
  }
  paymentInfo.wiseId = wiseId;
}

// Crypto validation
else if (paymentMethod === 'crypto') {
  const cryptoAddress = document.getElementById('standaloneCryptoAddress').value.trim();
  if (!cryptoAddress) {
    showToast('Please enter wallet address', 'error');
    return;
  }
  paymentInfo.crypto_address = cryptoAddress;
  paymentInfo.crypto_network = cryptoNetwork;  // erc20 or solana
}

// SWIFT validation
else if (paymentMethod === 'swift') {
  const swiftAccountHolder = document.getElementById('standaloneSwiftAccountHolder').value.trim();
  const swiftBic = document.getElementById('standaloneSwiftBic').value.trim();
  const swiftAccountNumber = document.getElementById('standaloneSwiftAccountNumber').value.trim();

  if (!swiftAccountHolder || !swiftBic || !swiftAccountNumber) {
    showToast('Please fill in required SWIFT fields', 'error');
    return;
  }

  // Include all SWIFT fields
  paymentInfo.swift_account_holder = swiftAccountHolder;
  paymentInfo.swift_bic = swiftBic;
  paymentInfo.swift_account_number = swiftAccountNumber;
  paymentInfo.swift_country = swiftCountry;
  paymentInfo.swift_city = swiftCity;
  paymentInfo.swift_address = swiftAddress;
  paymentInfo.swift_post_code = swiftPostCode;
  paymentInfo.swift_state = swiftState;
}
```

#### Auto-Retry After Save (`script.js:2876`)

```javascript
// After successful payment info submission
showToast('Payment info saved successfully', 'success');

// Close modal
const modal = document.getElementById('paymentInfoModal');
modal.classList.remove('active');

// Retry task submission now that payment info is set
setTimeout(() => {
  generateAndDownload();  // Retries task creation
}, 500);
```

### Backend Implementation (Admin Repo)

**Repository**: https://github.com/Parsewave-internal/admin
**Branch**: `feature/wise-email-update`

#### Service API Endpoints (`routes/serviceApi.js:279`)

These endpoints use **service key authentication** (X-Service-Key header) instead of OAuth, enabling service-to-service communication.

##### GET /api/service/contributor-payment-info/:username

**Purpose**: Check if contributor has payment info
**Auth**: Service key required
**Response**:
```json
{
  "success": true,
  "username": "johndoe",
  "paymentInfo": {
    "github_username": "johndoe",
    "email": "john@example.com",
    "payment_method": "wise",
    "wise_id": "@johndoe"
  },
  "hasPaymentInfo": true
}
```

**Implementation**:
```javascript
app.get('/api/service/contributor-payment-info/:username', requireServiceKey, async (req, res) => {
  try {
    const { username } = req.params;
    const paymentInfo = await db.getContributorPaymentInfoByGithub(username);

    res.json({
      success: true,
      username,
      paymentInfo,
      hasPaymentInfo: !!paymentInfo
    });
  } catch (err) {
    log('Error getting contributor payment info:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
```

##### POST /api/service/contributor-payment-info/:username

**Purpose**: Save/update contributor payment info
**Auth**: Service key required
**Request Body**:
```json
{
  "email": "john@example.com",
  "paymentMethod": "wise",
  "wiseId": "@johndoe",

  // OR for crypto:
  "crypto_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "crypto_network": "erc20",

  // OR for SWIFT:
  "swift_account_holder": "John Doe",
  "swift_bic": "DEUTDEFF",
  "swift_account_number": "DE89370400440532013000",
  "swift_country": "DE",
  "swift_city": "Berlin",
  "swift_address": "123 Main St",
  "swift_post_code": "10115",
  "swift_state": "Berlin"
}
```

**Response**:
```json
{
  "success": true,
  "paymentInfo": {
    "github_username": "johndoe",
    "email": "john@example.com",
    "payment_method": "wise",
    "wise_id": "@johndoe"
  }
}
```

**Implementation**:
```javascript
app.post('/api/service/contributor-payment-info/:username', requireServiceKey, async (req, res) => {
  try {
    const { username } = req.params;
    const {
      email, wiseId, paymentMethod,
      swift_account_holder, swift_bic, swift_account_number, swift_country,
      swift_city, swift_address, swift_post_code, swift_state,
      crypto_address, crypto_network
    } = req.body;

    const result = await db.upsertContributorPaymentInfoByGithub({
      githubUsername: username,
      email,
      wiseId,
      paymentMethod,
      swiftAccountHolder: swift_account_holder,
      swiftBic: swift_bic,
      swiftAccountNumber: swift_account_number,
      swiftCountry: swift_country,
      swiftCity: swift_city,
      swiftAddress: swift_address,
      swiftPostCode: swift_post_code,
      swiftState: swift_state,
      cryptoAddress: crypto_address,
      cryptoNetwork: crypto_network
    });

    log(`Payment info updated for ${username} by ${req.serviceName}`);
    res.json({ success: true, paymentInfo: result });
  } catch (err) {
    log('Error updating contributor payment info:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
```

#### Service Key Middleware (`routes/serviceApi.js:14`)

```javascript
const requireServiceKey = (req, res, next) => {
  const key = req.headers['x-service-key'];
  const expectedKey = process.env.SERVICE_API_KEY;

  if (!expectedKey) {
    log('SERVICE_API_KEY not configured');
    return res.status(500).json({ success: false, error: 'Service API not configured' });
  }

  if (!key || key !== expectedKey) {
    log('Invalid service key attempt');
    return res.status(401).json({ success: false, error: 'Invalid or missing service key' });
  }

  req.serviceName = req.headers['x-service-name'] || 'unknown';
  next();
};
```

**Environment Variable**:
```bash
SERVICE_API_KEY=dd4f22fe-1bab-4bda-8a2e-4586e2b4afc7
```

### Database Schema (PostgreSQL)

#### contributor_payment_info Table

```sql
CREATE TABLE contributor_payment_info (
  id SERIAL PRIMARY KEY,
  github_username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),

  -- Payment method: 'wise', 'crypto', 'swift'
  payment_method VARCHAR(50),

  -- Wise payment info
  wise_id VARCHAR(255),  -- @username or email

  -- Crypto payment info
  crypto_address VARCHAR(255),
  crypto_network VARCHAR(50),  -- 'erc20' or 'solana'

  -- SWIFT payment info
  swift_account_holder VARCHAR(255),
  swift_bic VARCHAR(50),
  swift_account_number VARCHAR(255),
  swift_country VARCHAR(10),
  swift_city VARCHAR(255),
  swift_address TEXT,
  swift_post_code VARCHAR(20),
  swift_state VARCHAR(255),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_info_username ON contributor_payment_info(github_username);
```

#### Database Function (`db/index.js:3136`)

```javascript
const upsertContributorPaymentInfoByGithub = async ({
  githubUsername, email, wiseId, paymentMethod,
  swiftAccountHolder, swiftBic, swiftAccountNumber, swiftCountry,
  swiftCity, swiftAddress, swiftPostCode, swiftState,
  cryptoAddress, cryptoNetwork
}) => {
  if (!githubUsername) throw new Error('githubUsername is required');

  const existing = await getContributorPaymentInfoByGithub(githubUsername);

  if (existing) {
    // Update - use COALESCE to preserve existing values when new value is null
    const result = await pool.query(
      `UPDATE contributor_payment_info SET
         email = COALESCE($2, email),
         wise_id = COALESCE($3, wise_id),
         payment_method = COALESCE($4, payment_method),
         swift_account_holder = COALESCE($5, swift_account_holder),
         swift_bic = COALESCE($6, swift_bic),
         swift_account_number = COALESCE($7, swift_account_number),
         swift_country = COALESCE($8, swift_country),
         swift_city = COALESCE($9, swift_city),
         swift_address = COALESCE($10, swift_address),
         swift_post_code = COALESCE($11, swift_post_code),
         swift_state = COALESCE($12, swift_state),
         crypto_address = COALESCE($13, crypto_address),
         crypto_network = COALESCE($14, crypto_network),
         updated_at = NOW()
       WHERE github_username = $1 RETURNING *`,
      [githubUsername, email, wiseId, paymentMethod,
       swiftAccountHolder, swiftBic, swiftAccountNumber, swiftCountry,
       swiftCity, swiftAddress, swiftPostCode, swiftState,
       cryptoAddress, cryptoNetwork]
    );
    return result.rows[0];
  } else {
    // Insert new
    const result = await pool.query(
      `INSERT INTO contributor_payment_info (
         github_username, email, wise_id, payment_method,
         swift_account_holder, swift_bic, swift_account_number, swift_country,
         swift_city, swift_address, swift_post_code, swift_state,
         crypto_address, crypto_network
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [githubUsername, email, wiseId, paymentMethod,
       swiftAccountHolder, swiftBic, swiftAccountNumber, swiftCountry,
       swiftCity, swiftAddress, swiftPostCode, swiftState,
       cryptoAddress, cryptoNetwork]
    );
    return result.rows[0];
  }
};
```

### Testing Locally

#### 1. Admin Server Setup

```bash
# Clone and setup admin repo
git clone https://github.com/Parsewave-internal/admin.git /tmp/parsewave-admin
cd /tmp/parsewave-admin
git checkout feature/wise-email-update

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/parsewave
DATABASE_SSL=false
SERVICE_API_KEY=dd4f22fe-1bab-4bda-8a2e-4586e2b4afc7
SESSION_SECRET=test-secret-key
ENABLE_AI_CHECK=false
EOF

# Run database migrations
psql -U postgres -d parsewave -f migrations/add_contributor_payment_info.sql

# Start server
node server.js
```

Server should start on http://localhost:3001

#### 2. GDPVAL Frontend Setup

```bash
# Clone and setup GDPVAL repo
git clone https://github.com/Parsewave-internal/GDPVAL.git /tmp/GDPVAL
cd /tmp/GDPVAL
git checkout feature/payment-info-form

# Update config for local testing
# Edit frontend/config.js:
window.GDPVAL_CONFIG = {
  BACKEND_API_URL: 'http://localhost:8000',
  API_PREFIX: '/api/gdpval'
};

# Start server
./run-server.sh server
```

Server should start on http://localhost:8000

#### 3. Test Payment Info Flow

**Step 1**: Open http://localhost:8000/gdpval-task.html

**Step 2**: Log in with test user (username: test, password: test123)

**Step 3**: Fill out task form completely

**Step 4**: Click "Generate & Download"
- Should show payment info modal
- Modal should be closable (X button or backdrop)
- Task form data should remain when modal closes

**Step 5**: Fill payment info (choose any method):

**Wise**:
- Email: test@example.com
- Payment Method: Wise
- Wise ID: @testuser

**Crypto**:
- Email: test@example.com
- Payment Method: Crypto
- Network: Solana
- Address: SomeBase58AddressHere123456789

**SWIFT**:
- Email: test@example.com
- Payment Method: SWIFT
- Account Holder: John Doe
- BIC: DEUTDEFF
- Account Number: DE89370400440532013000
- (optional: country, city, address, etc.)

**Step 6**: Click "Submit Payment Info"
- Should see success toast
- Modal should close
- Task submission should auto-retry
- Task should be created successfully

**Step 7**: Try submitting another task
- Should NOT show payment modal (info already saved)
- Should submit directly

#### 4. Test Service API with curl

**Check payment info**:
```bash
curl -X GET "http://localhost:3001/api/service/contributor-payment-info/test" \
  -H "X-Service-Key: dd4f22fe-1bab-4bda-8a2e-4586e2b4afc7"
```

**Expected response** (if exists):
```json
{
  "success": true,
  "username": "test",
  "paymentInfo": {
    "github_username": "test",
    "email": "test@example.com",
    "payment_method": "wise",
    "wise_id": "@testuser"
  },
  "hasPaymentInfo": true
}
```

**Create payment info**:
```bash
curl -X POST "http://localhost:3001/api/service/contributor-payment-info/test" \
  -H "Content-Type: application/json" \
  -H "X-Service-Key: dd4f22fe-1bab-4bda-8a2e-4586e2b4afc7" \
  -d '{
    "email": "test@example.com",
    "paymentMethod": "wise",
    "wiseId": "@testuser"
  }'
```

**Expected response**:
```json
{
  "success": true,
  "paymentInfo": {
    "github_username": "test",
    "email": "test@example.com",
    "payment_method": "wise",
    "wise_id": "@testuser"
  }
}
```

#### 5. Verify Database

```bash
psql -U postgres -d parsewave -c "SELECT * FROM contributor_payment_info WHERE github_username = 'test';"
```

Should show the payment info record with all fields.

### Common Issues

#### 1. Service API Not Found (404)

**Symptom**: Frontend gets 404 when checking payment info

**Cause**: Admin server not on `feature/wise-email-update` branch

**Fix**:
```bash
cd /tmp/parsewave-admin
git checkout feature/wise-email-update
git pull
node server.js
```

#### 2. Service Key Authentication Failed (401)

**Symptom**: "Invalid or missing service key" error

**Cause**: Missing or incorrect SERVICE_API_KEY in admin .env

**Fix**:
```bash
echo "SERVICE_API_KEY=dd4f22fe-1bab-4bda-8a2e-4586e2b4afc7" >> .env
```

#### 3. Email Field Not Saved

**Symptom**: Email is null in database even though provided

**Cause**: Old version of db/index.js without email field fix

**Fix**:
```bash
git pull origin feature/wise-email-update
# Restart server
```

#### 4. Payment Modal Not Showing

**Symptom**: Task submits without payment info check

**Cause**: GDPVAL not on `feature/payment-info-form` branch

**Fix**:
```bash
cd /tmp/GDPVAL
git checkout feature/payment-info-form
git pull
./run-server.sh server
```

#### 5. CORS Errors

**Symptom**: Frontend can't call admin API due to CORS

**Cause**: Admin server not configured for CORS

**Fix**: Add to admin server.js:
```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:8000');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Service-Key');
  next();
});
```

---

## Templates System

**Added**: January 5, 2026
**Purpose**: Allow users to save and reuse task configurations as templates

### Overview

Contributors can save their task configurations (instruction, rubrics, sources, files) as templates for reuse. This speeds up task creation for similar tasks and ensures consistency.

### Database Schema

#### GDPValTemplates Table

```
Primary Key: template_id (String)
Attributes:
  - template_id: "tmpl_<8 random chars>" (e.g., "tmpl_a1b2c3d4")
  - user_id: User who created the template
  - name: Template name (user-defined)
  - description: Optional description
  - sector: BLS sector
  - occupation: BLS occupation
  - instruction: Task instruction text
  - rubrics: JSON array of rubric objects
  - sources: JSON array of source objects
  - solutionFiles: JSON array with base64 encoded files
  - dataFiles: JSON array with base64 encoded files
  - created_at: ISO timestamp
  - updated_at: ISO timestamp

Global Secondary Index: UserIdIndex
  - Hash Key: user_id
  - Range Key: created_at
  - Projection: ALL
  - Purpose: Query user's templates sorted by creation date
```

**Table Creation**: Run `python backend/create_auth_tables.py` to create the table.

### Frontend Implementation

#### Save Template (`script.js:653`)

```javascript
async function saveAsTemplate() {
  const name = prompt('Enter template name:');
  if (!name) return;

  // Convert files to base64 for storage
  const solutionFilesData = await Promise.all(
    state.solutionFiles.map(async (file) => {
      const base64Content = await fileToBase64(file);
      return {
        name: file.name,
        path: file.webkitRelativePath || file.name,
        content: base64Content,
        mime_type: file.type,
        size: file.size
      };
    })
  );

  const dataFilesData = await Promise.all(
    state.referenceFiles.map(async (file) => {
      const base64Content = await fileToBase64(file);
      return {
        name: file.name,
        path: file.webkitRelativePath || file.name,
        content: base64Content,
        mime_type: file.type,
        size: file.size
      };
    })
  );

  const template = {
    name,
    description: '',
    sector: document.getElementById('sector').value,
    occupation: document.getElementById('occupation').value,
    instruction: document.getElementById('instruction').value,
    rubrics: getRubricData(),
    sources: getSourcesData(),
    solutionFiles: solutionFilesData,
    dataFiles: dataFilesData
  };

  const response = await fetch(apiUrl('/templates'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(template)
  });

  if (response.ok) {
    showToast(`Template "${name}" saved`, 'success');
    initializeTemplates();  // Reload templates list
  }
}
```

#### Load Templates (`script.js:444`)

```javascript
async function initializeTemplates() {
  const response = await fetch(apiUrl('/templates'), {
    credentials: 'include'
  });

  if (response.ok) {
    const data = await response.json();
    state.templates = data.templates || [];

    // Populate dropdown
    templateSelect.innerHTML = '<option value="">Select a template...</option>';
    state.templates.forEach(t => {
      const option = document.createElement('option');
      option.value = t.id;  // Backend maps template_id → id
      option.textContent = t.name;
      templateSelect.appendChild(option);
    });
  }
}
```

### Backend API

#### GET /api/gdpval/templates

**Auth**: Required (returns user's templates only)

**Response**:
```json
{
  "success": true,
  "templates": [
    {
      "id": "tmpl_a1b2c3d4",  // Mapped from template_id
      "template_id": "tmpl_a1b2c3d4",
      "user_id": "usr_test_001",
      "name": "Financial Analysis Template",
      "sector": "Finance and Insurance",
      "occupation": "Financial Analysts",
      "instruction": "...",
      "rubrics": [...],
      "sources": [...],
      "solutionFiles": [...],
      "dataFiles": [...],
      "created_at": "2026-01-05T00:00:00Z"
    }
  ]
}
```

**Backend** (`api_server.py:1785`):
```python
@app.get("/api/gdpval/templates")
async def get_templates(user_id: str = Depends(require_auth)):
    """Get saved templates for current user"""
    try:
        import boto3
        dynamodb = boto3.resource('dynamodb', region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(os.environ.get("GDPVAL_TEMPLATES_TABLE", "GDPValTemplates"))

        # Query templates for this user
        response = table.query(
            IndexName='UserIdIndex',
            KeyConditionExpression='user_id = :uid',
            ExpressionAttributeValues={':uid': user_id}
        )

        # Map template_id to id for frontend compatibility
        templates = [
            {**item, 'id': item['template_id']}
            for item in response.get('Items', [])
        ]
        return {"success": True, "templates": templates}
    except Exception as e:
        logger.error(f"Failed to get templates: {e}")
        return {"success": True, "templates": []}
```

#### POST /api/gdpval/templates

**Auth**: Required

**Request**:
```json
{
  "name": "Financial Analysis Template",
  "description": "Template for financial reports",
  "sector": "Finance and Insurance",
  "occupation": "Financial Analysts",
  "instruction": "Analyze the quarterly report...",
  "rubrics": [...],
  "sources": [...],
  "solutionFiles": [...],
  "dataFiles": [...]
}
```

**Response**:
```json
{
  "success": true,
  "template_id": "tmpl_a1b2c3d4",
  "message": "Template 'Financial Analysis Template' saved successfully"
}
```

**Backend** (`api_server.py:1808`):
```python
@app.post("/api/gdpval/templates")
async def create_template(
    template: TemplateRequest,
    user_id: str = Depends(require_auth)
):
    """Save a template"""
    try:
        import boto3
        from datetime import datetime, timezone

        dynamodb = boto3.resource('dynamodb', region_name=os.environ.get("AWS_REGION", "us-east-1"))
        table = dynamodb.Table(os.environ.get("GDPVAL_TEMPLATES_TABLE", "GDPValTemplates"))

        template_id = f"tmpl_{secrets.token_urlsafe(8)}"

        table.put_item(Item={
            'template_id': template_id,
            'user_id': user_id,
            'name': template.name,
            'description': template.description or '',
            'sector': template.sector or '',
            'occupation': template.occupation or '',
            'instruction': template.instruction,
            'rubrics': template.rubrics,
            'sources': template.sources,
            'solutionFiles': template.solutionFiles,
            'dataFiles': template.dataFiles,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        })

        return {
            "success": True,
            "template_id": template_id,
            "message": f"Template '{template.name}' saved successfully"
        }
    except Exception as e:
        logger.exception(f"Failed to save template: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save template: {str(e)}")
```

#### DELETE /api/gdpval/templates/{template_id}

**Auth**: Required (can only delete own templates)

**Response**:
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

### Validation

Tasks and templates are validated during save:
- Instruction word count must be ≤ 600 words (excluding rubric)
- Total rubric points: 12-60 (across all categories)
- Points per category: 4-10
- Rubric categories: 3-6
- Total rubric word count: ≤ 400 words
- **Analytic Rubric Format**: Each rubric must have 4 scoring levels:
  - Exemplary (4)
  - Proficient (3)
  - Basic (2)
  - Needs Improvement (1)
- All data files must have source attribution

**Backend** (`validators.py`):
```python
# Analytic rubric configuration
ANALYTIC_RUBRIC_LEVELS = 4
ANALYTIC_MIN_POINTS = 4
ANALYTIC_MAX_POINTS = 10
ANALYTIC_LABELS = [
    ("Needs Improvement", 1),
    ("Basic", 2),
    ("Proficient", 3),
    ("Exemplary", 4),
]

def validate_rubric(
    rubrics: list[dict],
    min_total_points: int = 12,
    max_total_points: int = 60,
    min_categories: int = 3,
    max_categories: int = 6,
    max_total_words: int = 400,
    min_points_per_category: int = 4,
    max_points_per_category: int = 10
) -> ValidationResult:
    # Validates category count, points range, analytic levels, and word count
    ...

def validate_sources_coverage(data_files: list[str], sources: list[dict]) -> ValidationResult:
    # Ensures all data files have source attribution
    ...
```

---

## Reviewer Dashboard

**Added**: January 5, 2026
**Purpose**: Allow devs/admins to review and manage submitted tasks

### Overview

The reviewer dashboard provides a central interface for reviewing tasks, checking GitHub PR status, and managing task queue.

### Frontend (`gdpval-review.html`)

**URL**: `https://gdpval.parsewave.ai/gdpval-review`
**Auth**: Dev/admin only

**Features**:
- View all tasks in queue
- Filter by status (pending, processing, completed, failed)
- See GitHub PR status with live updates
- Approve/reject tasks
- View task details inline
- GitHub API rate limiting (max 10 concurrent requests)

#### GitHub PR Status Integration (`reviewer-script.js:185`)

```javascript
async function enrichTasksWithPRStatus() {
  const tasksWithPRs = tasks.filter(t => t.pr_number);

  // Fetch PR data in batches to avoid rate limiting (max 10 concurrent)
  const BATCH_SIZE = 10;
  const results = [];

  for (let i = 0; i < tasksWithPRs.length; i += BATCH_SIZE) {
    const batch = tasksWithPRs.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(task =>
      fetchGitHubPR(task.pr_number).then(prData => ({ task, prData }))
    );
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  // Update tasks with PR status
  results.forEach(({ task, prData }) => {
    task.pr_status = prData.state;  // open, closed, merged
    task.pr_mergeable = prData.mergeable;
    task.pr_checks_status = prData.checks_status;
  });
}
```

### Backend API

#### GET /api/gdpval/reviewer/tasks

**Auth**: Dev/admin only

**Query Parameters**:
- `status`: Filter by task status
- `limit`: Max results (default 200)
- `offset`: Pagination offset

**Response**:
```json
{
  "tasks": [
    {
      "task_id": "abc123",
      "task_name": "Financial Analysis",
      "status": "pending",
      "pr_url": "https://github.com/org/repo/pull/123",
      "pr_number": 123,
      "created_by": "usr_test_001",
      "created_at": "2026-01-05T00:00:00Z"
    }
  ],
  "total": 42
}
```

**Backend** (`api_server.py:1265`):
```python
@app.get("/api/gdpval/reviewer/tasks")
async def get_reviewer_tasks(
    user_id: str = Depends(require_dev_role),  # Dev/admin only
    status: str | None = None,
    limit: int = 200,
    offset: int = 0
):
    """Get tasks for review"""
    import boto3
    dynamodb = boto3.resource('dynamodb', region_name=os.environ.get("AWS_REGION", "us-east-1"))
    table = dynamodb.Table(os.environ.get("GDPVAL_TASKS_TABLE", "GDPValTasks"))

    # Query all tasks (or filter by status)
    if status:
        response = table.query(
            IndexName='StatusIndex',
            KeyConditionExpression='status = :status',
            ExpressionAttributeValues={':status': status}
        )
    else:
        response = table.scan()

    tasks = response.get('Items', [])
    return {
        "tasks": tasks[offset:offset+limit],
        "total": len(tasks)
    }
```

---

## My Tasks Page

**Purpose**: Allow users to view and manage their own submitted tasks

### Frontend (`gdpval-my-tasks.html`)

**URL**: `https://gdpval.parsewave.ai/gdpval-my-tasks.html`
**Auth**: Required (any role - shows only user's own tasks)

**Features**:
- View all tasks submitted by current user
- Filter by status (pending, processing, completed, failed)
- Resubmit failed or rejected tasks
- View task details and PR status
- Track task lifecycle

### Backend API

#### GET /api/gdpval/tasks/mine

**Auth**: Required (returns only current user's tasks)

**Query Parameters**:
- `status`: Filter by task status
- `limit`: Max results (default 50)
- `offset`: Pagination offset

**Response**:
```json
{
  "tasks": [
    {
      "task_id": "abc123",
      "task_name": "Financial Analysis",
      "status": "completed",
      "pr_url": "https://github.com/org/repo/pull/123",
      "created_at": "2026-01-05T00:00:00Z",
      "updated_at": "2026-01-06T00:00:00Z"
    }
  ],
  "total": 5
}
```

---

## Email Verification & Password Reset

**Added**: January 5, 2026
**Purpose**: Enable secure account recovery and email verification

### Database Schema

#### GDPValTokens Table

```
Primary Key: token (String)
Attributes:
  - token: Random URL-safe token
  - user_id: User this token belongs to
  - token_type: "email_verification" | "password_reset"
  - created_at: ISO timestamp
  - expires_at: ISO timestamp
  - ttl: Unix timestamp (DynamoDB TTL for auto-cleanup)

TTL: Enabled on 'ttl' attribute for automatic token expiration
```

**Table Creation**: Run `python backend/create_auth_tables.py`

### Email Verification Flow

1. User registers → Backend creates email verification token
2. Backend sends email with verification link
3. User clicks link → `/verify-email?token=xyz`
4. Backend validates token → Marks email as verified
5. User can now log in

### Password Reset Flow

1. User clicks "Forgot Password" → Enters email
2. Backend creates password reset token
3. Backend sends email with reset link
4. User clicks link → `/reset-password?token=xyz`
5. User enters new password
6. Backend validates token → Updates password
7. User can log in with new password

### SMTP Configuration

**Required Environment Variables**:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Gmail App Password
SMTP_FROM_NAME=GDPVAL
APP_BASE_URL=https://gdpval.parsewave.ai
```

**Backend** (`email_service.py`):
```python
def send_verification_email(email: str, token: str):
    """Send email verification link"""
    verification_url = f"{APP_BASE_URL}/verify-email?token={token}"

    send_email(
        to_email=email,
        subject="Verify your GDPVal account",
        body=f"Click to verify: {verification_url}"
    )

def send_password_reset_email(email: str, token: str):
    """Send password reset link"""
    reset_url = f"{APP_BASE_URL}/reset-password?token={token}"

    send_email(
        to_email=email,
        subject="Reset your GDPVal password",
        body=f"Click to reset: {reset_url}"
    )
```

---

## Critical Routing Fix (MUST READ)

**Added**: January 5, 2026
**Issue**: All pages were loading task creator instead of their respective pages

### Problem

The StaticFiles mount at `/gdpval` was intercepting ALL requests to `/gdpval-*` paths BEFORE they could reach the route handlers:

```python
# ❌ WRONG - Mounted BEFORE route handlers
app.mount("/gdpval", StaticFiles(directory=_frontend_dir / "gdpval"), name="gdpval-static")

# These routes were NEVER reached:
@app.get("/gdpval-queue")      # Intercepted!
@app.get("/gdpval-reviewer")   # Intercepted!
@app.get("/gdpval-users")      # Intercepted!
```

### Solution

Changed StaticFiles mount path from `/gdpval` to `/static`:

```python
# ✅ CORRECT - Different prefix
app.mount("/static", StaticFiles(directory=_frontend_dir / "gdpval"), name="gdpval-static")

# Now these routes work:
@app.get("/gdpval-queue")      # ✅ Works
@app.get("/gdpval-reviewer")   # ✅ Works
@app.get("/gdpval-users")      # ✅ Works
```

### Frontend Updates

All HTML files updated to reference `/static/` instead of `/gdpval/`:

```html
<!-- Before -->
<link rel="stylesheet" href="/gdpval/style.css">
<script src="/gdpval/script.js"></script>

<!-- After -->
<link rel="stylesheet" href="/static/style.css">
<script src="/static/script.js"></script>
```

**Files Updated**:
- `gdpval-task.html`
- `gdpval-queue.html`
- `gdpval-review.html`
- `gdpval-my-tasks.html`
- `gdpval-users.html`
- `gdpval-login.html`
- `verify-email.html`
- `reset-password.html`

### Why This Matters

FastAPI StaticFiles creates a **catch-all route** that matches ANY path with that prefix. When registered early in the file, it takes priority over explicitly defined route handlers. This is a **critical** gotcha that will break all page routing.

**Rule**: StaticFiles mounts should either:
1. Come AFTER all route handlers (end of file), OR
2. Use a prefix that doesn't conflict with routes (like `/static` or `/assets`)

---

## Common Gotchas & Pitfalls

### 1. Login Endpoint Content-Type Mismatch

**Problem**: Frontend sends JSON, but backend expects Form data

**Symptoms**:
- 422 Unprocessable Entity on login
- "Field required" errors

**Wrong**:
```python
@app.post("/api/login")
async def login(
    username: str = Form(...),  # ❌ Expects form-urlencoded
    password: str = Form(...)
):
```

**Correct**:
```python
class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def login(request: LoginRequest):  # ✅ Accepts JSON
```

### 2. Login Response Format Mismatch

**Problem**: Frontend expects specific structure

**Wrong**:
```json
{
  "success": true,
  "username": "admin"
}
```

**Correct**:
```json
{
  "authenticated": true,
  "user": {
    "user_id": "usr_...",
    "username": "admin",
    "role": "dev"
  }
}
```

### 3. Missing `/logout` GET Endpoint

**Problem**: Sidebar logout link uses GET, not POST

**Frontend** (`sidebar.js:108`):
```html
<button onclick="parseAuth.logout()">...</button>
```

**Backend needs BOTH**:
```python
@app.post("/api/logout")  # For async fetch
async def logout(...):

@app.get("/logout")  # For redirects
async def logout_redirect(...):
```

### 4. Missing `/api/token-status` Endpoint

**Problem**: Frontend checks GitHub API rate limits

**Frontend** (somewhere in auth-ui.js or script.js):
```javascript
await fetch('/api/token-status');
```

**Backend must provide stub**:
```python
@app.get("/api/token-status")
async def get_token_status():
    return {
        "remaining": 5000,
        "limit": 5000,
        "reset": None,
        "status": "healthy"
    }
```

### 5. Wrong Global Auth Object

**Problem**: Using `window.auth` instead of `window.parseAuth`

**Wrong**:
```javascript
const userId = window.auth?.currentUserId;  // ❌ undefined
```

**Correct**:
```javascript
const userId = window.parseAuth?.currentUserId;  // ✅
```

### 6. Missing `credentials: 'include'`

**Problem**: Cookies not sent with fetch requests

**Wrong**:
```javascript
await fetch('/api/gdpval/users');  // ❌ No cookies sent
```

**Correct**:
```javascript
await fetch('/api/gdpval/users', {
  credentials: 'include'  // ✅ Sends session cookie
});
```

### 7. Logout Not Calling API

**Problem**: Just reloading without destroying session

**Wrong**:
```javascript
logout() {
  window.location.reload();  // ❌ Session still active
}
```

**Correct**:
```javascript
async logout() {
  await fetch('/api/logout', {
    method: 'POST',
    credentials: 'include'
  });
  window.location.reload();  // ✅ Session destroyed first
}
```

### 8. Sidebar Logout Button vs Link

**Problem**: Using `<a href="/logout">` loses JavaScript context

**Wrong**:
```html
<a href="/logout" class="sidebar-logout">...</a>
```

**Correct**:
```html
<button class="sidebar-logout" onclick="parseAuth.logout()">...</button>
```

**Also need CSS**:
```css
.sidebar-logout {
  border: none;
  cursor: pointer;
  background: transparent;
}
```

### 9. Page Initialization Before Auth

**Problem**: Page loads content before checking authentication

**Wrong**:
```javascript
document.addEventListener('DOMContentLoaded', () => {
  initializePageComponents();  // ❌ No auth check
});
```

**Correct**:
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  await authUI.init({
    onAuthenticated: () => {
      initializePageComponents();  // ✅ After auth
    }
  });
});
```

### 10. Config.js Hardcoded URL

**Problem**: `window.location.origin` breaks local testing

**Local Development**:
```javascript
BACKEND_API_URL: 'http://localhost:8000',
```

**Production**:
```javascript
BACKEND_API_URL: window.location.origin,
```

**Best Practice**: Use environment variable or detect:
```javascript
BACKEND_API_URL: window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : window.location.origin,
```

---

## Testing Checklist

### Before Creating PR

#### Backend Tests
- [ ] Start server: `./run-server.sh server`
- [ ] Create DynamoDB tables: `python3 backend/create_auth_tables.py`
- [ ] Test login with curl:
  ```bash
  curl -X POST http://localhost:8000/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}'
  ```
  Expected: `{"authenticated": true, "user": {...}}`

- [ ] Test `/api/user` with session cookie
- [ ] Test `/api/logout`
- [ ] Test `/api/token-status`
- [ ] Test user creation (dev only)
- [ ] Test user deletion (dev only)
- [ ] Test permission checks

#### Frontend Tests
- [ ] Open `http://localhost:8000/gdpval-task.html`
- [ ] Login modal appears (if not logged in)
- [ ] Login with admin/admin123 succeeds
- [ ] Sidebar shows all 3 pages (dev role)
- [ ] Logout works and shows login modal again
- [ ] Login with test/test123 succeeds
- [ ] Sidebar shows ONLY task creator (contributor role)
- [ ] Cannot access `/gdpval-queue.html` (redirects)
- [ ] Cannot access `/gdpval-users.html` (redirects)
- [ ] Create task works
- [ ] User management shows all users (dev only)
- [ ] Create new user works
- [ ] Delete user works (except self)

#### Integration Tests
- [ ] Create task as contributor
- [ ] View task in queue as dev
- [ ] Check task appears in DynamoDB
- [ ] Worker picks up task (if worker running)
- [ ] PR created successfully

#### Browser Console Checks
- [ ] No 404 errors
- [ ] No 422 errors
- [ ] No CORS errors
- [ ] Session cookie set (`gdpval_session`)
- [ ] `window.parseAuth.currentUserId` is set
- [ ] Sidebar filtering works correctly

---

## Summary for Future Developers

**If you're implementing auth/permissions:**
1. Read the [Authentication System](#authentication-system-critical) section completely
2. Check EXACT response formats in examples
3. Verify `credentials: 'include'` on all fetch calls
4. Use `window.parseAuth`, NOT `window.auth`
5. Test login/logout flow manually before creating PR
6. Check browser console for errors

**If you're adding new endpoints:**
1. Check if frontend calls it (grep codebase)
2. Add required stub if needed (like `/api/token-status`)
3. Always require auth: `Depends(require_auth)`
4. Return exact format frontend expects

**If you're modifying frontend:**
1. Check sidebar.js for permission filtering
2. Add permission checks on page load
3. Initialize AFTER `authUI.init()`
4. Always use `credentials: 'include'`

**If debugging:**
1. Check browser Network tab for failed requests
2. Verify session cookie is sent
3. Check backend logs for errors
4. Verify DynamoDB tables exist and have data
5. Test with curl to isolate frontend vs backend issues

---

**Last Updated**: January 7, 2026
**Changes**: Updated repository structure, fixed reviewer page naming (gdpval-review.html), updated validation rules (analytic rubric format, 12-60 points, 400 word limit), added My Tasks page, added pipeline/terminal_bench documentation
**Maintainer**: Development Team
**Repository**: https://github.com/Parsewave-internal/GDPVAL
