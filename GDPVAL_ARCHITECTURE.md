# GDPVal Complete System Architecture (Updated Jan 2026)

## ⚠️ CRITICAL: READ THIS FIRST

**This document contains EXACT specifications that must be followed.**
Missing any detail here will cause runtime failures.

**Last Major Update**: January 4, 2026 - Added DynamoDB authentication, user management, role-based permissions

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
│   └── create_auth_tables.py      ← DynamoDB setup script
│
├── frontend/
│   ├── gdpval-task.html           ← Task creator (ALL users)
│   ├── gdpval-queue.html          ← Queue viewer (DEV/ADMIN only)
│   ├── gdpval-users.html          ← User management (DEV/ADMIN only)
│   ├── config.js                  ← Backend URL configuration
│   └── gdpval/
│       ├── auth.js                ← Auth state management
│       ├── auth-ui.js             ← Login modal
│       ├── sidebar.js             ← Navigation (role-based filtering)
│       ├── sidebar.css
│       ├── script.js              ← Task creator logic
│       └── queue-script.js        ← Queue viewer logic
│
├── pipeline/                      ← Python task processing
│   └── scripts/
│       └── task_submit.py         ← Task submission to DynamoDB
│
└── run-server.sh                  ← Server startup script
```

**Deployment**:
- Frontend served from `/frontend/` directory
- URLs:
  - `https://gdpval.parsewave.ai/gdpval-task.html`
  - `https://gdpval.parsewave.ai/gdpval-queue.html`
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

| Role         | Task Creator | Queue Viewer | User Management |
|--------------|-------------|--------------|-----------------|
| **Contributor** | ✅          | ❌           | ❌              |
| **Dev**         | ✅          | ✅           | ✅              |
| **Admin**       | ✅          | ✅           | ✅              |

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

### Sidebar Filtering (`sidebar.js:189`)

```javascript
function filterMenuItems(permissions) {
  // Handle GDPVal permission system (object with boolean flags)
  if (typeof permissions === 'object' && !Array.isArray(permissions)) {
    const allowed = new Set();

    if (permissions.can_create_tasks) {
      allowed.add('/gdpval-task');
    }

    if (permissions.can_view_queue) {
      allowed.add('/gdpval-queue');
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

**Last Updated**: January 4, 2026
**Maintainer**: Development Team
**Repository**: https://github.com/Parsewave-internal/GDPVAL
