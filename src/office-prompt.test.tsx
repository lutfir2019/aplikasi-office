// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OfficeDetail } from './pages/Office.tsx'
import type { OfficeStation } from './types.ts'

const testEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true

const station: OfficeStation = {
  id: 'coder', name: 'coder', role: 'Hermes profile', room: 'Workspace', roomPosition: 'assigned-desk',
  state: 'Working', currentTask: 'Review office behavior', tasks: [], recentActivity: 'No attributed recent activity',
  activity: 'Kanban: Review office behavior', seat: 1, provenance: 'Test evidence', freshness: 'Current',
}

let root: Root | undefined

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  root = undefined
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

/**
 * Types into a controlled React textarea: the value has to go through the prototype setter,
 * otherwise React's own value tracker never sees the change and onChange does not fire.
 */
async function type(textarea: HTMLTextAreaElement, text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  await act(async () => {
    textarea.focus()
    setValue.call(textarea, text)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Mounts the dialog and switches to the Run Task tab, as a viewer would. */
async function openRunTask(props: Partial<Parameters<typeof OfficeDetail>[0]> = {}) {
  const host = document.body.appendChild(document.createElement('div'))
  root = createRoot(host)
  await act(async () => { root!.render(<OfficeDetail station={station} onClose={vi.fn()} {...props}/>) })
  const tab = [...document.querySelectorAll<HTMLButtonElement>('.detail-tabs button')].find((button) => button.textContent === 'Run Task')
  expect(tab).toBeTruthy()
  await act(async () => { tab!.click() })
  return {
    textarea: document.querySelector<HTMLTextAreaElement>('.prompt-textarea')!,
    send: document.querySelector<HTMLButtonElement>('.prompt-actions .primary-button')!,
  }
}

describe('Office Run Task tab', () => {
  it('offers an empty, labelled prompt with a character counter and no way to submit nothing', async () => {
    const { textarea, send } = await openRunTask()

    expect(textarea.getAttribute('aria-label')).toBe('Task instruction for coder')
    expect(textarea.value).toBe('')
    expect(document.querySelector('#prompt-char-counter')?.textContent).toBe('0 / 4,000')
    expect(textarea.getAttribute('aria-describedby')).toBe('prompt-char-counter')
    expect(send.disabled).toBe(true)
    expect(document.activeElement).toBe(textarea)
  })

  it('disables the prompt while sending, then shows the created task id on a 201 response', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
      calls.push(String(path))
      if (path === '/api/tasks') {
        expect(init?.method).toBe('POST')
        expect((init?.headers as Record<string, string>)['x-ruang-request']).toBe('1')
        expect(JSON.parse(String(init?.body))).toEqual({ profile: 'coder', prompt: 'Do the review' })
        await Promise.resolve()
        return new Response(JSON.stringify({ ok: true, task: { id: 't_newtask1', status: 'ready' } }), { status: 201 })
      }
      return new Response('{}', { status: 200 })
    }))
    const { textarea, send } = await openRunTask()
    await type(textarea, 'Do the review')
    expect(send.disabled).toBe(false)
    await act(async () => { send.click(); await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    const alert = document.querySelector('[role="alert"]')!
    expect(alert.textContent).toContain('t_newtask1')
    expect(textarea.value).toBe('')
    expect(document.querySelector('#prompt-char-counter')?.textContent).toBe('0 / 4,000')
    expect(['/api/office?fresh=1', '/api/tasks?fresh=1', '/api/dashboard?fresh=1'].every((path) => calls.includes(path))).toBe(true)
  })

  it('shows a readable server error and re-enables the prompt for a retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "Unknown or inactive agent profile 'coder'" }), { status: 400 })))
    const { textarea, send } = await openRunTask()
    await type(textarea, 'Do something')
    await act(async () => { send.click(); await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    const alert = document.querySelector('[role="alert"]')!
    expect(alert.textContent).toContain("Unknown or inactive agent profile 'coder'")
    expect(textarea.disabled).toBe(false)
    expect(send.disabled).toBe(false)
  })

  it('shows a connection error when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    const { textarea, send } = await openRunTask()
    await type(textarea, 'Do something')
    await act(async () => { send.click(); await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not reach the server')
  })

  it('sends only one request when the send button is clicked twice mid-flight', async () => {
    let posts = 0
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      if (path === '/api/tasks') {
        posts += 1
        await new Promise((resolve) => setTimeout(resolve, 5))
        return new Response(JSON.stringify({ ok: true, task: { id: 't_once', status: 'ready' } }), { status: 201 })
      }
      return new Response('{}', { status: 200 })
    }))
    const { textarea, send } = await openRunTask()
    await type(textarea, 'Do it once')
    await act(async () => { send.click(); send.click(); await new Promise((resolve) => setTimeout(resolve, 20)) })
    expect(posts).toBe(1)
  })
})
