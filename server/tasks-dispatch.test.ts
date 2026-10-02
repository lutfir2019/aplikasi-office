import { describe, expect, it } from 'vitest'
import express, { type Request, type Response } from 'express'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { AccessStore, installAccess, Throttle } from './access.js'
import {
  CommandError,
  createTask,
  invalidateTaskCaches,
  parseCreatedTask,
  submitTask,
  taskInputError,
  TaskRequestError,
  type CreateTaskInput,
} from './mission-control.js'

describe('parseCreatedTask', () => {
  it('parses raw Hermes kanban create JSON output into CreatedTask', () => {
    const raw = JSON.stringify({
      id: 't_70442bac',
      title: 'Investigate memory leak in background worker',
      assignee: 'architect',
      status: 'ready',
      priority: 10,
      workspace_kind: 'dir',
      workspace_path: '/home/mapeor/Projects/ruang',
      created_at: 1790859828,
    })

    const task = parseCreatedTask(raw)
    expect(task).toEqual({
      id: 't_70442bac',
      title: 'Investigate memory leak in background worker',
      assignee: 'architect',
      status: 'ready',
      priority: 10,
      workspace_kind: 'dir',
      workspace_path: '/home/mapeor/Projects/ruang',
      createdAt: new Date(1790859828 * 1000).toISOString(),
    })
  })

  it('tolerates preamble notice lines before JSON document', () => {
    const raw = 'Notice: profile cache updated\n{"id": "t_abc12345", "title": "Quick task", "status": "todo"}'
    expect(parseCreatedTask(raw)).toMatchObject({
      id: 't_abc12345',
      title: 'Quick task',
      status: 'todo',
    })
  })

  it('rejects output without id or title', () => {
    expect(() => parseCreatedTask('{"status": "ready"}')).toThrow('Unrecognized Kanban task output.')
    expect(() => parseCreatedTask('not json')).toThrow()
  })
})

describe('taskInputError validation', () => {
  const roster = ['architect', 'backend', 'frontend']

  it('accepts valid inputs', () => {
    expect(taskInputError({ profile: 'backend', prompt: 'Do work' }, roster)).toBeUndefined()
    expect(taskInputError({ profile: 'architect', prompt: 'Fix', priority: 50, workspace_kind: 'dir', workspace_path: '/tmp/test' }, roster)).toBeUndefined()
  })

  it('rejects profiles not in active Hermes roster', () => {
    expect(taskInputError({ profile: 'unknown', prompt: 'test' }, roster)).toBe(
      "Unknown or inactive agent profile 'unknown'. Must be one of: architect, backend, frontend.",
    )
  })

  it('rejects invalid profile name formats', () => {
    expect(taskInputError({ profile: '--profile', prompt: 'test' }, roster)).toBe('Unknown or inactive agent profile.')
    expect(taskInputError({ profile: '', prompt: 'test' }, roster)).toBe('Unknown or inactive agent profile.')
  })

  it('rejects empty or whitespace prompts', () => {
    expect(taskInputError({ profile: 'backend', prompt: '' }, roster)).toBe('Prompt must be between 1 and 4000 characters.')
    expect(taskInputError({ profile: 'backend', prompt: '   \n  ' }, roster)).toBe('Prompt must be between 1 and 4000 characters.')
  })

  it('rejects oversized prompts > 4000 chars', () => {
    const huge = 'a'.repeat(4001)
    expect(taskInputError({ profile: 'backend', prompt: huge }, roster)).toBe('Prompt must be between 1 and 4000 characters.')
  })

  it('rejects invalid priority values', () => {
    expect(taskInputError({ profile: 'backend', prompt: 'test', priority: 101 }, roster)).toBe('Priority must be an integer between -100 and 100.')
    expect(taskInputError({ profile: 'backend', prompt: 'test', priority: -101 }, roster)).toBe('Priority must be an integer between -100 and 100.')
    expect(taskInputError({ profile: 'backend', prompt: 'test', priority: 1.5 as unknown as number }, roster)).toBe('Priority must be an integer between -100 and 100.')
  })

  it('rejects invalid workspace kinds', () => {
    expect(taskInputError({ profile: 'backend', prompt: 'test', workspace_kind: 'invalid' as unknown as CreateTaskInput['workspace_kind'] }, roster)).toBe(
      'Workspace kind must be one of: dir, scratch, worktree.',
    )
  })

  it('rejects relative or traversal paths for workspace_path', () => {
    expect(taskInputError({ profile: 'backend', prompt: 'test', workspace_path: 'relative/path' }, roster)).toBe(
      'Workspace path must be an absolute path without directory traversal.',
    )
    expect(taskInputError({ profile: 'backend', prompt: 'test', workspace_path: '/home/../etc' }, roster)).toBe(
      'Workspace path must be an absolute path without directory traversal.',
    )
  })
})

describe('createTask command dispatch', () => {
  it('executes hermes kanban create with safe discrete argv and audit label', async () => {
    const calls: { file: string; args: string[]; options?: unknown }[] = []
    const mockRun = async (file: string, args: string[], options?: unknown) => {
      calls.push({ file, args, options })
      return JSON.stringify({
        id: 't_created01',
        title: 'Safe task execution',
        assignee: 'backend',
        status: 'ready',
        priority: 5,
        workspace_kind: 'dir',
        workspace_path: '/home/mapeor/Projects/ruang',
      })
    }

    const task = await createTask({
      profile: 'backend',
      prompt: 'Safe task execution',
      priority: 5,
      workspace_kind: 'dir',
      workspace_path: '/home/mapeor/Projects/ruang',
    }, mockRun)

    expect(task.id).toBe('t_created01')
    expect(calls).toHaveLength(1)
    expect(calls[0].file).toBe('hermes')
    expect(calls[0].args).toEqual([
      'kanban',
      'create',
      'Safe task execution',
      '--assignee',
      'backend',
      '--workspace',
      'dir:/home/mapeor/Projects/ruang',
      '--priority',
      '5',
      '--triage',
      '--json',
    ])
    // Prompt text must be masked in auditLabel
    expect((calls[0].options as { auditLabel?: string })?.auditLabel).toBe('hermes kanban create [prompt 19 chars] --assignee backend')
  })

  it('creates large prompts in triage for native Hermes decomposition', async () => {
    const calls: string[][] = []
    const mockRun = async (_file: string, args: string[]) => {
      calls.push(args)
      return JSON.stringify({ id: 't_triage', title: 'Large task', status: 'triage' })
    }

    const task = await createTask({ profile: 'backend', prompt: 'Large task' }, mockRun)

    expect(task.status).toBe('triage')
    expect(calls[0]).toContain('--triage')
  })

  it('formats scratch workspace properly', async () => {
    const calls: string[][] = []
    const mockRun = async (_file: string, args: string[]) => {
      calls.push(args)
      return JSON.stringify({ id: 't_scratch', title: 'Scratch task', status: 'triage' })
    }

    await createTask({ profile: 'backend', prompt: 'Scratch task', workspace_kind: 'scratch' }, mockRun)
    expect(calls[0]).toContain('scratch')
    expect(calls[0][calls[0].indexOf('--workspace') + 1]).toBe('scratch')
  })
})

describe('submitTask orchestration', () => {
  it('enforces validation, calls runner, and triggers cache invalidation', async () => {
    let invalidated = false
    const mockRun = async () => JSON.stringify({ id: 't_orch1', title: 'Orch task', assignee: 'backend', status: 'ready' })

    const task = await submitTask(
      { profile: 'backend', prompt: 'Orch task' },
      {
        roster: async () => ['backend', 'frontend'],
        run: mockRun,
        invalidate: () => { invalidated = true },
      },
    )

    expect(task.id).toBe('t_orch1')
    expect(invalidated).toBe(true)
  })

  it('throws 503 when roster is empty/unavailable', async () => {
    await expect(
      submitTask({ profile: 'backend', prompt: 'Task' }, { roster: async () => [] }),
    ).rejects.toThrow(new TaskRequestError('The Hermes profile roster is unavailable, so no task was created.', 503))
  })

  it('rejects non-object request bodies before running subprocess', async () => {
    let runCalled = false
    await expect(submitTask(null, {
      roster: async () => ['backend'],
      run: async () => { runCalled = true; return '' },
    })).rejects.toThrow(new TaskRequestError('Request body must be a JSON object.', 400))
    expect(runCalled).toBe(false)
  })

  it('throws 400 when validation fails without running subprocess', async () => {
    let runCalled = false
    await expect(
      submitTask(
        { profile: 'backend', prompt: '   ' },
        {
          roster: async () => ['backend'],
          run: async () => { runCalled = true; return '' },
        },
      ),
    ).rejects.toThrow(new TaskRequestError('Prompt must be between 1 and 4000 characters.', 400))
    expect(runCalled).toBe(false)
  })

  it('translates CommandError into 500 TaskRequestError', async () => {
    await expect(
      submitTask(
        { profile: 'backend', prompt: 'Work' },
        {
          roster: async () => ['backend'],
          run: async () => { throw new CommandError('Command exited with code 1.', 'COMMAND_FAILED') },
        },
      ),
    ).rejects.toThrow(new TaskRequestError('Failed to create Kanban task: Command exited with code 1.', 500))
  })
})

describe('HTTP integration for POST /api/tasks', () => {
  let server: ReturnType<express.Express['listen']>
  let base: string
  let store: AccessStore
  const CODE = 'test-access-code-1234'

  const startTestServer = async (withAccessEnabled = false) => {
    const app = express()
    const dir = await mkdtemp(join(tmpdir(), 'ruang-tasks-test-'))
    store = new AccessStore(dir)
    if (withAccessEnabled) await store.set(CODE)
    installAccess(app, store, new Throttle())

    app.post('/api/tasks', express.json({ limit: '64kb' }), async (request: Request, response: Response) => {
      if (request.get('x-ruang-request') !== '1') {
        response.status(403).json({ error: 'Forbidden: missing or invalid x-ruang-request header.' })
        return
      }
      try {
        const task = await submitTask(request.body as CreateTaskInput, {
          roster: async () => ['architect', 'backend', 'frontend'],
          run: async (_file, args) => JSON.stringify({
            id: 't_mocked123',
            title: args[2],
            assignee: args[4],
            status: 'ready',
            priority: Number(args[8]),
            workspace_kind: 'dir',
            workspace_path: '/home/mapeor/Projects/ruang',
            created_at: 1790859828,
          }),
          invalidate: invalidateTaskCaches,
        })
        response.status(201).json({ ok: true, task })
      } catch (error) {
        if (error instanceof TaskRequestError) {
          response.status(error.status).json({ ok: false, error: error.message })
          return
        }
        throw error
      }
    })

    server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  }

  const stopTestServer = async () => {
    if (server) await new Promise((resolve) => server.close(resolve))
  }

  it('creates task and returns 201 when valid and header present', async () => {
    await startTestServer()
    try {
      const res = await fetch(`${base}/api/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ruang-request': '1' },
        body: JSON.stringify({ profile: 'backend', prompt: 'Implement new API', priority: 10 }),
      })
      expect(res.status).toBe(201)
      const data = await res.json() as Record<string, unknown>
      expect(data).toEqual({
        ok: true,
        task: {
          id: 't_mocked123',
          title: 'Implement new API',
          assignee: 'backend',
          status: 'ready',
          priority: 10,
          workspace_kind: 'dir',
          workspace_path: '/home/mapeor/Projects/ruang',
          createdAt: new Date(1790859828 * 1000).toISOString(),
        },
      })
    } finally {
      await stopTestServer()
    }
  })

  it('rejects with 403 when x-ruang-request header is missing', async () => {
    await startTestServer()
    try {
      const res = await fetch(`${base}/api/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: 'backend', prompt: 'Implement new API' }),
      })
      expect(res.status).toBe(403)
      const data = await res.json() as Record<string, unknown>
      expect(data.error).toContain('Forbidden: missing or invalid x-ruang-request header.')
    } finally {
      await stopTestServer()
    }
  })

  it('returns 400 when profile is not in roster', async () => {
    await startTestServer()
    try {
      const res = await fetch(`${base}/api/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ruang-request': '1' },
        body: JSON.stringify({ profile: 'hacker', prompt: 'Exploit' }),
      })
      expect(res.status).toBe(400)
      const data = await res.json() as Record<string, unknown>
      expect(data.ok).toBe(false)
      expect(data.error).toContain("Unknown or inactive agent profile 'hacker'")
    } finally {
      await stopTestServer()
    }
  })

  it('enforces 401 when Ruang access code is enabled and locked', async () => {
    await startTestServer(true)
    try {
      const res = await fetch(`${base}/api/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ruang-request': '1' },
        body: JSON.stringify({ profile: 'backend', prompt: 'Work' }),
      })
      expect(res.status).toBe(401)
      const data = await res.json() as Record<string, unknown>
      expect(data.locked).toBe(true)
    } finally {
      await stopTestServer()
    }
  })
})
