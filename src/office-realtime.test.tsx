// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Office } from './pages/Office.tsx'
import type { ActivitySnapshot, ChannelSnapshot, OfficeSnapshot, OfficeStation } from './types.ts'

const testEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true

function station(overrides: Partial<OfficeStation> = {}): OfficeStation {
  return {
    id: 'coder', name: 'coder', role: 'Hermes profile', room: 'Workspace', roomPosition: 'assigned-desk', state: 'Working',
    currentTask: 'Review office behavior', tasks: [], recentActivity: 'No attributed recent activity',
    activity: 'Kanban: Review office behavior', seat: 1, provenance: 'Test evidence', freshness: 'Current',
    ...overrides,
  }
}

function snapshot(stations: OfficeStation[]): OfficeSnapshot {
  return {
    stations,
    summary: { declared: 1, active: 1, idle: 0, offline: 0, unknown: 0, gatewaysReachable: 1, gatewaysDeclared: 1 },
    fetchedAt: '2026-09-27T12:00:00.000Z',
  }
}

const activity: ActivitySnapshot = { sessions: { availability: 'available', data: [] }, fetchedAt: '2026-09-27T12:00:00.000Z' }
const channels: ChannelSnapshot = { channels: { availability: 'available', data: [] }, fetchedAt: '2026-09-27T12:00:00.000Z' }

/** Types into a controlled React textarea through the prototype setter, so onChange fires. */
async function type(textarea: HTMLTextAreaElement, text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  await act(async () => {
    textarea.focus()
    setValue.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren() })

describe('Office real-time task sync', () => {
  it('shows the dispatched task on the avatar badge and in Active tasks by profile without a reload', async () => {
    // /api/office answers with no task until the prompt is dispatched, then with it.
    let created = false
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
      const url = String(path)
      calls.push(url)
      if (init?.method === 'POST') {
        created = true
        return new Response(JSON.stringify({ ok: true, task: { id: 't_live1', status: 'ready' } }), { status: 201 })
      }
      if (url.startsWith('/api/office')) return new Response(JSON.stringify(created
        ? snapshot([station({ tasks: [{ id: 't_live1', title: 'Echo safe verification task', status: 'ready' }] })])
        : snapshot([station()])), { status: 200 })
      return new Response(JSON.stringify(url.startsWith('/api/activity') ? activity : channels), { status: 200 })
    }))
    const host = document.body.appendChild(document.createElement('div'))
    const root = createRoot(host)

    await act(async () => { root.render(<Office/>); await Promise.resolve() })
    await act(async () => { document.querySelector<HTMLButtonElement>('[aria-label^="coder"]')!.click() })
    const runTask = [...document.querySelectorAll<HTMLButtonElement>('.detail-tabs button')].find((button) => button.textContent === 'Run Task')!
    await act(async () => { runTask.click() })
    await type(document.querySelector<HTMLTextAreaElement>('.prompt-textarea')!, 'Echo safe verification task')
    await act(async () => { document.querySelector<HTMLButtonElement>('.prompt-actions .primary-button')!.click(); await Promise.resolve() })
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })

    expect(calls).toContain('/api/office?fresh=1')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('t_live1')
    // The refreshed office snapshot repaints the avatar badge and the activity feed.
    expect(document.querySelector('.station-task')?.textContent).toBe('Echo safe verification task')
    await act(async () => { root.unmount() })
  })

  it('keeps the roster and avatars intact when the office snapshot is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
      if (init?.method === 'POST') return new Response(JSON.stringify({ ok: false, error: 'Ruang is locked' }), { status: 401 })
      const url = String(path)
      if (url.startsWith('/api/office')) return new Response(JSON.stringify(snapshot([station()])), { status: 200 })
      return new Response(JSON.stringify(url.startsWith('/api/activity') ? activity : channels), { status: 200 })
    }))
    const host = document.body.appendChild(document.createElement('div'))
    const root = createRoot(host)

    await act(async () => { root.render(<Office/>); await Promise.resolve() })
    const trigger = document.querySelector<HTMLButtonElement>('[aria-label^="coder"]')!
    await act(async () => { trigger.click() })
    const runTask = [...document.querySelectorAll<HTMLButtonElement>('.detail-tabs button')].find((button) => button.textContent === 'Run Task')!
    await act(async () => { runTask.click() })
    await type(document.querySelector<HTMLTextAreaElement>('.prompt-textarea')!, 'Blocked dispatch')
    await act(async () => { document.querySelector<HTMLButtonElement>('.prompt-actions .primary-button')!.click(); await Promise.resolve() })
    await act(async () => { await Promise.resolve() })

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Ruang is locked')
    expect(document.querySelector('.pixel-character')).toBeTruthy()
    await act(async () => { document.querySelector<HTMLButtonElement>('.office-close')!.click() })
    expect(document.querySelector<HTMLButtonElement>('[aria-label^="coder"]')).toBeTruthy()
    await act(async () => { root.unmount() })
  })
})
