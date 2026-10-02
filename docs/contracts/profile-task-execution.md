# Architecture & Contract: Profile-Directed Task Execution in Ruang Office

**Document Version:** 1.0.0  
**Status:** Approved Architectural Spec  
**Author:** System Architect  
**Downstream Implementers:** Backend (`t_dfaf0ab4`), UI/UX (`t_4c403cb6`), Frontend (`t_2329ae28`), QA (`t_6ff530d0`)

---

## 1. Overview & Objective

Ruang currently provides real-time observability of Hermes agents through 2D and 3D virtual office stations, showing agent presence, current Kanban tasks, and system activity. 

This specification establishes the architecture, security model, and interface contracts to enable **bidirectional interaction**: allowing an operator to click an agent station in Office, compose an instruction prompt, and dispatch a persistent task directly to that agent's Hermes profile via Hermes Kanban.

```
┌────────────────┐        POST /api/tasks         ┌─────────────────────────┐
│  Ruang Office  │ ─────────────────────────────> │  Ruang Express Server   │
│ (OfficeDetail) │ <───────────────────────────── │     (server/index.ts)   │
└────────────────┘       201 Created {task}       └────────────┬────────────┘
        │                                                      │
        │ ?fresh=1 (invalidate & re-fetch)                     │ execFile (argv array)
        ▼                                                      ▼
┌────────────────┐        read-through cache      ┌─────────────────────────┐
│ /api/office    │ ─────────────────────────────> │  hermes kanban create   │
│ /api/tasks     │                                │    --assignee <profile> │
└────────────────┘                                └────────────┬────────────┘
        │                                                      │
        ▼                                                      ▼
┌────────────────┐                                ┌─────────────────────────┐
│ Avatar Badge   │ <─── worker dispatch event ─── │    Hermes Dispatcher    │
│ & SpeechBubble │                                │   & kanban.db (ready    │
│ (Working Desk) │                                │       -> running)       │
└────────────────┘                                └─────────────────────────┘
```

---

## 2. Non-Goals

To maintain system stability and prevent scope creep, the following are explicitly **out of scope**:
1. **Multi-Agent Swarm / Pipeline Graph Authoring from UI:** Ruang Office dispatch triggers single profile-directed tasks. Swarm graphs (parent/child DAGs) remain the domain of Hermes CLI (`hermes kanban swarm`) or agent orchestrators.
2. **Interactive Terminal / PTY Streaming in Prompt Dialog:** The prompt dialog is an asynchronous task submission interface, not an interactive shell or REPL.
3. **Direct SQLite Database Modification:** Ruang will never execute raw SQL against `~/.hermes/kanban.db`. All Kanban mutations must traverse the canonical Hermes CLI interface.
4. **Arbitrary Command Execution:** No ad-hoc bash or system commands may be run through this interface.

---

## 3. Component Architecture & Responsibilities

| Component | Responsibility | Boundary / Contract |
| :--- | :--- | :--- |
| **Frontend: `OfficeDetail`** (`src/pages/Office.tsx`) | Presents prompt input tab for selected station, handles client validation, loading state, double-click prevention, and accessible alerts. | Calls `POST /api/tasks` with JSON payload and `x-ruang-request: 1` header. |
| **Frontend: Visual Office** (2D & 3D) | Reflects updated task count and active status via `StationTasks` stacked badge, speech bubble, and Live Activity feed. | Subscribed to `/api/office` and `/api/tasks` via polling + `?fresh=1`. |
| **Server: API & Auth Gate** (`server/index.ts`) | Authenticates request against `installAccess`, verifies CSRF header, parses JSON body up to 64KB, validates input constraints. | Enforces 401 (locked), 403 (missing header), 400 (validation failure). |
| **Server: Kanban Dispatcher** (`server/mission-control.ts`) | Verifies profile against active Hermes roster, executes `hermes kanban create` with safe `execFile` argument array, invalidates server cache. | Invokes CLI safely without shell interpolation; invalidates `taskBoardSource` and `runtimeSource`. |
| **Hermes Kanban Engine** (`kanban.db` & Gateway) | Persists task record, emits lifecycle events (`created`, `promoted`, `claimed`, `spawned`), executes agent worker. | Manages atomic state machine: `ready` -> `running` -> `done`/`failed`. |

---

## 4. Interface Contracts

### 4.1. Endpoint Specification: `POST /api/tasks`

- **URL:** `/api/tasks`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json` (Required)
  - `x-ruang-request: 1` (Required; CSRF defense header consistent with Ruang access endpoints)
  - `Cookie: ruang_session=<token>` (Required if access code is configured and locked)

#### Request Schema (JSON)
```json
{
  "profile": "architect",
  "prompt": "Investigate memory leak in background worker",
  "priority": 10,
  "workspace_kind": "dir",
  "workspace_path": "/home/mapeor/Projects/ruang"
}
```

| Field | Type | Required | Default | Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `profile` | `string` | **Yes** | — | Must match regex `/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/` AND exist in active Hermes roster (`getSnapshot().profiles`). |
| `prompt` | `string` | **Yes** | — | Non-empty trimmed string. Minimum length: 1 character. Maximum length: 4,000 characters. |
| `priority` | `number` | No | `0` | Integer between `-100` and `100`. |
| `workspace_kind` | `string` | No | `"dir"` | One of: `"dir"`, `"scratch"`, `"worktree"`. |
| `workspace_path` | `string` | No | Ruang repo path | Absolute path string. If provided, must not contain directory traversal sequences (`..`). |

#### Response Schema

##### Success: `201 Created`
```json
{
  "ok": true,
  "task": {
    "id": "t_70442bac",
    "title": "Investigate memory leak in background worker",
    "assignee": "architect",
    "status": "ready",
    "priority": 10,
    "workspace_kind": "dir",
    "workspace_path": "/home/mapeor/Projects/ruang",
    "createdAt": "2026-10-01T20:00:00.000Z"
  }
}
```

##### Client Error: `400 Bad Request`
Returned when validation fails or the target profile is unknown:
```json
{
  "ok": false,
  "error": "Unknown or inactive agent profile 'unknown-agent'. Must be one of: architect, backend, frontend, qa, pm, uiux, leader."
}
```
Or for empty/oversized prompt:
```json
{
  "ok": false,
  "error": "Prompt must be between 1 and 4000 characters."
}
```

##### Unauthorized Error: `401 Unauthorized`
Returned when Ruang access code is enabled and no valid session cookie is provided:
```json
{
  "error": "Ruang is locked. Enter the access code.",
  "locked": true
}
```

##### Forbidden Error: `403 Forbidden`
Returned when `x-ruang-request: 1` header is omitted:
```json
{
  "error": "Forbidden: missing or invalid x-ruang-request header."
}
```

##### Server Error: `500 Internal Server Error`
Returned if Hermes CLI execution fails:
```json
{
  "ok": false,
  "error": "Failed to create Kanban task: Command exited with code 1."
}
```

---

## 5. Command Execution & Security Architecture

### 5.1. CLI Invocation via `execFile`
Shell string interpolation (`exec("hermes kanban create " + prompt)`) is **strictly prohibited**.
The server must invoke `execFile` passing discrete argument tokens:

```typescript
const args = [
  'kanban',
  'create',
  prompt,
  '--assignee',
  profile,
  '--workspace',
  `${workspaceKind}:${workspacePath}`,
  '--priority',
  String(priority),
  '--json',
]

// Execute without shell wrapper
const { stdout } = await execFile('hermes', args, {
  timeout: 20_000,
  env: sanitizedEnv,
})
```

### 5.2. Environment Sanitization
When executed inside Hermes subagents or delegated child environments, `HERMES_DELEGATED_CHILD_CONTEXT` restricts kanban mutations.
The execution helper must strip this variable before running `execFile`:
```typescript
const sanitizedEnv = { ...process.env, NO_COLOR: '1', TERM: 'dumb' }
delete sanitizedEnv.HERMES_DELEGATED_CHILD_CONTEXT
```

### 5.3. Profile Roster Whitelisting
Before any CLI command is executed:
1. The server reads the current roster from `getSnapshot()` (cached or fresh).
2. The server verifies that `profile` exists in `runtime.profiles.data.map(p => p.name)`.
3. If not found, immediately abort with `400 Bad Request` without executing any subprocess.

---

## 6. State Synchronization & Caching Strategy

### 6.1. Invalidation Pipeline
Ruang server caches GET queries to `/api/tasks`, `/api/office`, and `/api/dashboard` for 10 seconds.
Upon successful `POST /api/tasks`:
1. **Server Invalidation:**
   - Execute `taskBoardSource.clear()`
   - Execute `runtimeSource.clear()`
2. **Client Refresh Handshake:**
   - Upon receiving HTTP 201, the UI issues parallel re-fetches with query parameter `?fresh=1`:
     - `/api/tasks?fresh=1`
     - `/api/office?fresh=1`
     - `/api/dashboard?fresh=1`
   - Ruang server's `FRESH_WINDOW_MS` (8,000 ms) automatically bypasses stale cache windows.

### 6.2. Lifecycle to Office State Transition Mapping

| Task Status (`kanban.db`) | Station State (`buildOfficeSnapshot`) | Room Placement | Avatar Visuals (`StationTasks` & Speech) | Live Activity Feed |
| :--- | :--- | :--- | :--- | :--- |
| **`ready`** | `Idle` (if no other task is running) | `Lounge` (Seat #N) | Shows stacked badge `<span class="station-task status-ready">Task title</span>` | Listed under "Active tasks by profile" |
| **`running`** | `Working` | `Workspace` (Hot desk) | Badge updates to `status-running`. Speech bubble appears: `Kanban: Task title` | Listed as active running task |
| **`review`** | `Reviewing` | `Workspace` (Review desk) | Badge updates to `status-review`. Speech bubble: `Reviewing: Task title` | Listed as under review |
| **`done`** | `Idle` | `Lounge` | Task badge removed from stack. Station returns to break. | Removed from active feed |
| **`blocked`** | `Idle` / `Unknown` | `Lounge` / Desk | Badge removed or marked blocked. | Removed from active feed |

---

## 7. Tradeoffs & Rejected Alternatives

### Alternative 1: Direct SQLite mutation to `~/.hermes/kanban.db`
- **Rejected Because:** Bypasses Hermes CLI invariants, lifecycle event bus triggers (`task_events`), atomic lock reclamation, and automatic migrations. In the event of schema changes in Hermes, direct SQLite writes would cause silent database corruption.
- **Chosen:** Canonical `hermes kanban create --json` via `execFile`.

### Alternative 2: Shell execution string (`sh -c` / `child_process.exec`)
- **Rejected Because:** Susceptible to command injection if prompt text contains metacharacters (quotes, semicolons, `$()`, pipes).
- **Chosen:** Parameterized array execution with `child_process.execFile`.

### Alternative 3: WebSocket / SSE push for instant task propagation
- **Rejected Because:** Ruang is architected around lightweight, stateless polling (`usePolling` hook). Introducing WebSocket infrastructure adds connection state, reconnect logic, and proxy complexity without meaningful user benefit.
- **Chosen:** Cache invalidation on mutation combined with UI-triggered `?fresh=1` fetch, providing <200ms visual updates with zero additional infrastructure.

---

## 8. Rollback & Migration Path

1. **Database Schema:** None. Ruang maintains no custom database; Kanban state resides entirely within Hermes's native SQLite storage.
2. **API Backward Compatibility:** Adding `POST /api/tasks` is purely additive. If reverted, all existing `GET` endpoints remain unaffected.
3. **Rollback Execution:**
   - Git revert backend route `POST /api/tasks` and UI Prompt tab.
   - Tasks created prior to rollback remain valid tasks in Hermes Kanban and can be executed or archived via `hermes kanban archive <task_id>`.

---

## 9. Contract Test Matrix

| Boundary | Test File | Test Case Description | Expected Result |
| :--- | :--- | :--- | :--- |
| **API Validation** | `server/tasks-dispatch.test.ts` | Valid task creation payload | Returns 201 with `{ ok: true, task: { id, title, assignee, status: 'ready' } }` |
| **API Validation** | `server/tasks-dispatch.test.ts` | Arbitrary/unregistered profile name | Returns 400 Bad Request with specific error message |
| **API Validation** | `server/tasks-dispatch.test.ts` | Empty or whitespace-only prompt | Returns 400 Bad Request |
| **API Validation** | `server/tasks-dispatch.test.ts` | Prompt exceeding 4,000 characters | Returns 400 Bad Request |
| **Security** | `server/tasks-dispatch.test.ts` | Missing `x-ruang-request: 1` header | Returns 403 Forbidden |
| **Security** | `server/tasks-dispatch.test.ts` | Access code enabled without session | Returns 401 Unauthorized with `{ locked: true }` |
| **Security** | `server/tasks-dispatch.test.ts` | Command injection attempt in prompt | Arguments passed safely as literal argv element; shell syntax inert |
| **Cache Sync** | `server/tasks-dispatch.test.ts` | Invalidation on task creation | Verifies `taskBoardSource.clear()` is called |
| **State Mapping** | `src/office-state.test.ts` | Station mapping with `ready` vs `running` tasks | Correct transition from `Idle` to `Working` when task starts running |
| **UI Form** | `src/office-prompt.test.tsx` | Double-click / duplicate submission | Submit button disables immediately on click; second click blocked |
| **Accessibility** | `src/office-dialog-focus.test.tsx` | Keyboard focus in prompt form | Tab cycling trapped inside dialog; Escape closes dialog |
