# QA Verification Report: Profile-Directed Task Execution

**Date**: 2026-10-01  
**Target**: Ruang (`http://127.0.0.1:3317` test instance, production bundle build)  
**Parent Task**: `t_6ff530d0`  
**Verdict**: **PASS / SHIP READY**

---

## 1. Executive Summary
- Live end-to-end task run verified with real Hermes worker execution (`backend` profile).
- Lifecycle fully observed: `created (ready)` -> `claimed` -> `spawned` -> `heartbeat` -> `completed (done)`.
- Boundary & security matrix passed (11/11 automated checks on live HTTP API).
- Access control policy enforced (401 locked behavior covered in test suite).
- Command safety verified against shell metacharacters without shell expansion.
- Accessibility and UI resilience verified via automated unit/integration tests and browser session interaction.
- Regression suite clean: `148 passed across 20 test files`, `eslint .` clean, `npm run build` clean.

---

## 2. Live End-to-End Workflow Verification

### Task Execution Evidence
- **Task ID**: `t_3ec1a60f`
- **Assignee**: `backend`
- **Initial Status**: `ready`
- **Prompt**: `"Echo safe verification task"`
- **Response**: HTTP 201 Created with JSON payload:
  ```json
  {
    "ok": true,
    "task": {
      "id": "t_3ec1a60f",
      "title": "Echo safe verification task",
      "assignee": "backend",
      "status": "ready",
      "priority": 0,
      "workspace_kind": "dir",
      "workspace_path": "/home/mapeor/Projects/ruang",
      "createdAt": "2026-10-01T14:23:47.000Z"
    }
  }
  ```
- **Lifecycle Events in `kanban.db`**:
  - `created`: `1790864627`
  - `claimed`: `1790864643` (run_id 9)
  - `spawned`: `1790864643` (PID `356029`)
  - `heartbeat`: `1790864649`
  - `completed`: `1790864700`
- **Result & Summary**:
  - Result: `echo-safe-verification: PASS`
  - Summary: `"Safe verification berhasil: command /bin/echo 'echo-safe-verification: PASS' berjalan dengan exit code 0. Tidak ada perubahan code."`
- **UI Observation**:
  - Avatar `backend` dynamically moved to `Workspace` room when transitioning to `Working`.
  - Station badge updated with `Echo safe verification task` (`status-running`) without page reload.
  - Accessible name updated to: `backend. Working: Kanban: Echo safe verification task. 1 task: Echo safe verification task (running). Open station details.`
  - Task Board rendered task under `DONE (7)` after completion.

---

## 3. Boundary & Security Testing Matrix

All requests executed against live HTTP endpoints with `Content-Type: application/json` and `x-ruang-request: 1`:

| Test Case | Payload / Condition | Expected | Actual Status | Result |
|---|---|---|---|---|
| Unknown profile | `{"profile":"hacker","prompt":"Exploit"}` | 400 | 400 | PASS |
| Option-like profile | `{"profile":"--assignee","prompt":"x"}` | 400 | 400 | PASS |
| Empty prompt | `{"profile":"backend","prompt":""}` | 400 | 400 | PASS |
| Whitespace prompt | `{"profile":"backend","prompt":"   \\n  "}` | 400 | 400 | PASS |
| Oversized prompt (>4000) | 4001 characters string | 400 | 400 | PASS |
| Missing CSRF header | omit `x-ruang-request` | 403 | 403 | PASS |
| Float priority | `{"priority": 1.5}` | 400 | 400 | PASS |
| Relative workspace path | `{"workspace_path":"relative/path"}` | 400 | 400 | PASS |
| Directory traversal path | `{"workspace_path":"/home/../etc"}` | 400 | 400 | PASS |
| Invalid workspace kind | `{"workspace_kind":"rootfs"}` | 400 | 400 | PASS |
| Non-object body | `"plain text"` | 400 | 400 | PASS |

### Duplicate Submit Prevention
- Rapid double-click simulated on the live submit button in browser context.
- Observed total requests sent: exactly `1`. Button was disabled during flight with spinner.

### Command Safety Verification
- Task created via API: `t_889a509c`.
- Prompt containing shell metacharacters:
  `"Safety probe literal & | ; $HOME $(id) \`id\` quote-test -- reply PROBE-OK"`
- Stored title in `kanban.db` verified verbatim without evaluation:
  `"Safety probe literal & | ; $HOME $(id) \`id\` quote-test -- reply PROBE-OK"`
- Status transitioned cleanly to `done`.

### Access Control Verification
- When access code lock is enabled, unauthenticated POST requests to `/api/tasks` respond with:
  - HTTP `401 Unauthorized`
  - Body: `{"error":"Ruang is locked. Enter the access code.","locked":true}`
- Verified in `server/tasks-dispatch.test.ts`.

---

## 4. Accessibility & UI Resilience

- **Dialog Role & Semantics**: `role="dialog"`, `aria-modal="true"`, labelled by title.
- **Focus Management**:
  - Focus lands on Close control initially.
  - Tab cycle wraps between first and last focusable element in dialog.
  - `Escape` key closes dialog immediately and restores focus to station button trigger.
- **Resilience**:
  - Roster avatars remain stable and rendered when task dispatch encounters server validation errors or locked state.
  - Error alert with retry action displays inline with `role="alert"`.

---

## 5. Build, Lint & Test Suite Status
- `npm test`: **148/148 passed** across 20 test files.
- `npm run lint`: **0 errors, 0 warnings** (`eslint .`).
- `npm run build`: **Success** (`tsc -b && vite build && tsc -p tsconfig.server.build.json`).
