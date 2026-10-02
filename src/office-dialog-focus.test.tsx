// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Office } from './pages/Office.tsx'
import type { ActivitySnapshot, ChannelSnapshot, OfficeSnapshot } from './types.ts'

const testEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true

const office: OfficeSnapshot = {
  stations: [{ id: 'default', name: 'default', role: 'Hermes profile', room: 'Workspace', roomPosition: 'assigned-desk', state: 'Working', currentTask: 'Review focus behavior', tasks: [], recentActivity: 'No attributed recent activity', activity: 'Kanban: Review focus behavior', seat: 1, provenance: 'Test evidence', freshness: 'Current' }],
  summary: { declared: 1, active: 1, idle: 0, offline: 0, unknown: 0, gatewaysReachable: 1, gatewaysDeclared: 1 }, fetchedAt: '2026-09-27T12:00:00.000Z',
}
const activity: ActivitySnapshot = { sessions: { availability: 'available', data: [] }, fetchedAt: office.fetchedAt }
const channels: ChannelSnapshot = { channels: { availability: 'available', data: [] }, fetchedAt: office.fetchedAt }

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren() })

describe('Office detail dialog focus', () => {
  it('contains Tab navigation and restores the station trigger after Escape closes it', async () => {
    vi.stubGlobal('fetch', vi.fn((path: string) => Promise.resolve(new Response(JSON.stringify(path === '/api/office' ? office : path === '/api/activity' ? activity : channels)))))
    const host = document.body.appendChild(document.createElement('div'))
    const root = createRoot(host)

    await act(async () => { root.render(<Office/>); await Promise.resolve() })
    const trigger = document.querySelector<HTMLButtonElement>('[aria-label^="default"]')!
    await act(async () => { trigger.click() })
    const close = document.querySelector<HTMLButtonElement>('.office-close')!
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('.detail-tabs button')]
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Overview', 'Folder', 'Memory', 'Run Task'])
    const last = tabs[tabs.length - 1]
    // Tab from the last control wraps to the first (Close); Shift+Tab from Close wraps back.
    last.focus()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    await act(async () => { last.dispatchEvent(tab) })
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close)

    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    await act(async () => { close.dispatchEvent(shiftTab) })
    expect(shiftTab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
    close.focus()

    await act(async () => { close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(document.activeElement).toBe(trigger)
    await act(async () => { root.unmount() })
  })
})
