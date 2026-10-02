import { Component, lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { agentLook } from '../agents.ts'
import { officeStateBadge } from '../office-state.ts'
import { usePolling } from '../polling.ts'
import { formatDateTime } from '../format.ts'
import type { Page } from '../routes.ts'
import type { ActivitySnapshot, ChannelSnapshot, DashboardSnapshot, OfficeRoom, OfficeSnapshot, OfficeStation } from '../types.ts'
import { LoadingState, SourceStatus } from '../ui.tsx'
import { CalendarOverlayView } from './Calendar.tsx'
import { AgentFolder } from './Folders.tsx'
import { AgentMemoryView } from './Memory.tsx'
import { Stats } from './Stats.tsx'
import { TaskBoard } from './TaskBoard.tsx'

// The 3D view (three.js) is only downloaded when someone switches to it.
const Office3D = lazy(() => import('./Office3D.tsx'))
type OfficeView = '2d' | '3d'

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** 3D unless the viewer chose 2D before (or the browser has no WebGL, handled by the caller). */
function storedView(): OfficeView {
  try { return window.localStorage.getItem('mc.officeView') === '2d' ? '2d' : '3d' } catch { return '3d' }
}

type PanelTab = 'Crew' | 'Stats' | 'Activity'
const PANEL_TABS: PanelTab[] = ['Crew', 'Stats', 'Activity']

function storedPanel(): PanelTab | undefined {
  try {
    const value = window.localStorage.getItem('mc.officePanel')
    return PANEL_TABS.find((tab) => tab === value)
  } catch { return undefined }
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

const ROOMS: OfficeRoom[] = ['Workspace', 'Lounge']

/** A pixel character dressed in the colours derived from the agent id. */
export function PixelCharacter({ agent }: { agent: string }) {
  const look = agentLook(agent)
  const style = { '--hair': look.hair, '--skin': look.skin, '--shirt': look.shirt, '--pants': look.pants } as CSSProperties
  return <span className="pixel-character" style={style} aria-hidden="true"><span className="character-hair"/><span className="character-head"><i/><b/></span><span className="character-torso"/><span className="character-arm left"/><span className="character-arm right"/><span className="character-leg left"/><span className="character-leg right"/></span>
}

function officeStateLabel(station: OfficeStation): string {
  return station.state === 'Idle' ? 'Idle · managed placement' : station.state
}

/** Spoken form of the task list, so the visual list can stay aria-hidden inside a button. */
function taskSummary(station: OfficeStation): string {
  const tasks = station.tasks ?? []
  if (tasks.length === 0) return ''
  return ` ${tasks.length} task${tasks.length === 1 ? '' : 's'}: ${tasks.map((task) => `${task.title} (${task.status})`).join(', ')}.`
}

/**
 * Every open task of one agent, stacked over its head. Spans, not a list: the office avatar is a
 * button, and a button may only contain phrasing content.
 */
function StationTasks({ station }: { station: OfficeStation }) {
  const tasks = station.tasks ?? []
  if (tasks.length === 0) return null
  return <span className="station-tasks" aria-hidden="true">{tasks.map((task) => <span key={task.id ?? task.title} className={`station-task status-${task.status.toLowerCase()}`}>{task.title}</span>)}</span>
}

type DetailTab = 'Overview' | 'Folder' | 'Memory' | 'Prompt'
const DETAIL_TABS: { tab: DetailTab; label: string }[] = [
  { tab: 'Overview', label: 'Overview' }, { tab: 'Folder', label: 'Folder' }, { tab: 'Memory', label: 'Memory' }, { tab: 'Prompt', label: 'Run Task' },
]
const PROMPT_LIMIT = 4000

type PromptResult = { kind: 'success'; taskId: string; status: string } | { kind: 'error'; message: string }

function friendlyError(status: number, body: unknown): string {
  const message = typeof body === 'object' && body && 'error' in body && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : undefined
  if (status === 400) return message ?? 'The task could not be validated.'
  if (status === 401) return 'Ruang is locked. Enter the access code to dispatch tasks.'
  if (status === 403) return 'Request rejected by the server. Refresh the page and try again.'
  if (status === 500) return 'The server could not create the task. Check Logs for details.'
  return message ?? `The server answered HTTP ${status}.`
}

/** The Run Task tab: dispatch a prompt to this station's profile via POST /api/tasks. */
function PromptTab({ station, onDispatched }: { station: OfficeStation; onDispatched?: () => void }) {
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<PromptResult | null>(null)
  const [overLimit, setOverLimit] = useState(false)
  const submittingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { textareaRef.current?.focus() }, [])
  useEffect(() => {
    if (!result || result.kind !== 'success') return
    const timer = setTimeout(() => setResult(null), 8_000)
    return () => clearTimeout(timer)
  }, [result])

  const dispatch = async () => {
    if (submittingRef.current || !prompt.trim() || prompt.length > PROMPT_LIMIT) return
    submittingRef.current = true
    setSubmitting(true)
    setResult(null)
    try {
      const response = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ruang-request': '1' }, body: JSON.stringify({ profile: station.id, prompt: prompt.trim() }) })
      const body = await response.json().catch(() => undefined)
      if (response.ok) {
        setResult({ kind: 'success', taskId: body.task.id, status: body.task.status })
        setPrompt('')
        void fetch('/api/office?fresh=1')
        void fetch('/api/tasks?fresh=1')
        void fetch('/api/dashboard?fresh=1')
        onDispatched?.()
      } else {
        setResult({ kind: 'error', message: friendlyError(response.status, body) })
      }
    } catch {
      setResult({ kind: 'error', message: 'Could not reach the server. Check your connection.' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const remaining = PROMPT_LIMIT - prompt.length
  const counterTone = remaining < 50 ? 'counter-danger' : remaining < 200 ? 'counter-warn' : ''
  return <section aria-busy={submitting}>
    <div className="prompt-profile-badge" aria-label={`Dispatching to ${station.name}`}>
      <PixelCharacter agent={station.id}/>
      <span><strong>{station.name}</strong><small>{station.role}</small></span>
      <span className={`badge ${officeStateBadge(station.state).tone}`}>{station.state}</span>
    </div>
    <textarea
      ref={textareaRef}
      className={`prompt-textarea${overLimit ? ' textarea-error' : ''}`}
      value={prompt}
      disabled={submitting}
      placeholder="Describe the task…"
      aria-label={`Task instruction for ${station.name}`}
      aria-describedby="prompt-char-counter"
      onChange={(event) => { setPrompt(event.target.value); setOverLimit(false) }}
    />
    <div className={`prompt-counter ${counterTone}`} id="prompt-char-counter">{prompt.length.toLocaleString()} / {PROMPT_LIMIT.toLocaleString()}</div>
    <div className="prompt-actions">
      <button type="button" className="primary-button" disabled={submitting || !prompt.trim() || prompt.length > PROMPT_LIMIT} aria-disabled={submitting || !prompt.trim() || prompt.length > PROMPT_LIMIT} aria-label={submitting ? 'Sending task, please wait' : undefined} onClick={() => { if (prompt.length > PROMPT_LIMIT) setOverLimit(true); else void dispatch() }}>
        {submitting ? <><span className="prompt-spinner" aria-hidden="true"/>Sending…</> : 'Send Task ▶'}
      </button>
      <button type="button" className="ghost-button" disabled={submitting || !prompt} onClick={() => { setPrompt(''); setOverLimit(false); textareaRef.current?.focus() }}>Clear</button>
    </div>
    {result?.kind === 'success' && <div className="form-success" role="alert" aria-live="polite">Task dispatched · <code>{result.taskId}</code> <span className="badge neutral">{result.status}</span> <button type="button" className="prompt-link" onClick={() => window.open(`#/task-board/${result.taskId}`, '_self')}>View in Task Board ↗</button></div>}
    {result?.kind === 'error' && <div className="form-error" role="alert" aria-live="assertive">{result.message} <button type="button" className="prompt-retry" onClick={() => void dispatch()}>Retry</button></div>}
  </section>
}

export function OfficeDetail({ station, onClose, onDispatched }: { station: OfficeStation; onClose: () => void; onDispatched?: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [tab, setTab] = useState<DetailTab>('Overview')
  useEffect(() => { closeRef.current?.focus() }, [])
  const badge = officeStateBadge(station.state)
  const profile = station.id
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
    if (!focusable?.length) { event.preventDefault(); return }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
      event.preventDefault()
      const target = event.shiftKey ? last : first
      target.focus()
    }
  }
  return <div className="office-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className={`office-detail${tab === 'Folder' || tab === 'Memory' ? ' wide' : ''}`} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="office-detail-title" onKeyDown={onKeyDown}>
      <button className="office-close" ref={closeRef} onClick={onClose} aria-label={`Close ${station.name} details`}>Close</button>
      <div className="detail-head"><div className="detail-avatar"><PixelCharacter agent={station.id}/></div><div><p className="eyebrow">STATION DETAIL</p><h2 id="office-detail-title">{station.name}</h2><span className={`badge ${badge.tone}`}>{officeStateLabel(station)}</span></div></div>
      {profile && <div className="detail-tabs" role="tablist" aria-label={`${station.name} details`}>{DETAIL_TABS.map(({ tab: item, label }) => <button type="button" role="tab" key={item} aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{label}</button>)}</div>}
      <div role="tabpanel" aria-label={tab === 'Prompt' ? 'Run Task' : tab} aria-busy={tab === 'Prompt' ? undefined : false} className="detail-body">
        {tab === 'Overview' && <>{station.activity && <p className="detail-activity">{station.activity}</p>}
          <dl className="office-detail-grid"><div><dt>Agent type</dt><dd>{station.role}</dd></div><div><dt>Current room</dt><dd>{station.room} / {station.roomPosition}</dd></div><div><dt>Current task</dt><dd>{station.currentTask}</dd></div><div><dt>Recent activity</dt><dd>{station.recentActivity}</dd></div><div><dt>Source / provenance</dt><dd>{station.provenance}</dd></div><div><dt>Freshness</dt><dd>{station.freshness}</dd></div></dl></>}
        {tab === 'Folder' && profile && <AgentFolder profile={profile}/>}
        {tab === 'Memory' && profile && <AgentMemoryView profile={profile}/>}
        {tab === 'Prompt' && profile && <PromptTab station={station} onDispatched={onDispatched}/>}
      </div>
    </section>
  </div>
}

type OverlayKind = 'tasks' | 'calendar'
const OVERLAYS: Record<OverlayKind, { title: string; page: Page }> = { tasks: { title: 'Task Board', page: 'Task Board' }, calendar: { title: 'Calendar', page: 'Calendar' } }

/** Task Board or the cron calendar shown over the office, without leaving it. */
function OfficeOverlay({ kind, onClose, onNavigate }: { kind: OverlayKind; onClose: () => void; onNavigate?: (page: Page) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { closeRef.current?.focus() }, [kind])
  const { title, page } = OVERLAYS[kind]
  return <section className={`office-overlay overlay-${kind}`} role="dialog" aria-modal="false" aria-labelledby="office-overlay-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header className="office-overlay-head">
      <h2 id="office-overlay-title">{title}</h2>
      {onNavigate && <button type="button" className="refresh-button" onClick={() => onNavigate(page)}>Open full page ↗</button>}
      <button type="button" ref={closeRef} className="icon-button" onClick={onClose} aria-label={`Close ${title}`}>✕</button>
    </header>
    <div className="office-overlay-body">{kind === 'tasks' ? <TaskBoard/> : <CalendarOverlayView/>}</div>
  </section>
}

interface HudItem { label: string; value: string; tone?: 'warn' | 'bad'; page?: Page; title?: string }

/** The few numbers worth seeing at a glance, over the office like a game HUD. */
function hudItems(office: OfficeSnapshot | undefined, dashboard: DashboardSnapshot | null | undefined): HudItem[] {
  // The dashboard's office summary is only a fallback while /api/office is still reading. Its
  // counts come from the runtime read, so an unavailable runtime would report a truthful-looking
  // 0/0 for a crew that is simply not read yet.
  const summary = office?.summary ?? (dashboard?.runtime.profiles.availability === 'available' ? dashboard.office : undefined)
  const items: HudItem[] = []
  if (summary) {
    items.push({ label: 'Crew active', value: `${summary.active}/${summary.declared}`, title: `${summary.idle} idle · ${summary.offline} offline · ${summary.unknown} unknown` })
    items.push({ label: 'Gateways', value: `${summary.gatewaysReachable}/${summary.gatewaysDeclared}`, title: 'Profiles whose Hermes gateway is running (CLI-only agents need none)', page: 'Agents' })
  } else {
    items.push({ label: 'Crew active', value: 'Reading...', tone: 'warn', title: 'The office source has not answered yet' })
  }
  if (!dashboard) return items
  const { tasks, calendar, commands } = dashboard
  if (tasks.availability === 'available') {
    const open = Object.entries(tasks.byStatus).filter(([status]) => !['done', 'archived'].includes(status)).reduce((sum, [, count]) => sum + count, 0)
    items.push({ label: 'Tasks', value: `${tasks.byStatus.running ?? 0} running · ${open} open`, page: 'Task Board' })
  } else items.push({ label: 'Tasks', value: 'Not Available', tone: 'warn', page: 'Task Board' })
  if (calendar.availability === 'available') items.push({ label: 'Next cron', value: calendar.nextRun ? formatDateTime(calendar.nextRun) : '—', page: 'Calendar' })
  if (commands.failed > 0) items.push({ label: 'CLI errors', value: String(commands.failed), tone: 'bad', page: 'Logs' })
  return items
}

export function Office({ dashboard, dashboardPending = false, onNavigate }: { dashboard?: DashboardSnapshot | null; dashboardPending?: boolean; onNavigate?: (page: Page) => void } = {}) {
  const snapshot = usePolling<OfficeSnapshot>('/api/office', 10_000)
  const activitySnapshot = usePolling<ActivitySnapshot>('/api/activity', 15_000)
  const channelsSnapshot = usePolling<ChannelSnapshot>('/api/channels', 30_000)
  const office = snapshot.status === 'ready' ? snapshot.data : undefined
  const activity = activitySnapshot.status === 'ready' ? activitySnapshot.data : undefined
  const channels = channelsSnapshot.status === 'ready' ? channelsSnapshot.data : undefined
  const [selectedName, setSelectedName] = useState<OfficeStation['name'] | undefined>()
  const selectedTrigger = useRef<HTMLElement | null>(null)
  const [chosenRoom, setChosenRoom] = useState<OfficeRoom | undefined>()
  const [view, setView] = useState<OfficeView>(() => typeof window === 'undefined' ? '2d' : storedView())
  const [webgl] = useState(() => typeof document === 'undefined' || webglAvailable())
  const [panel, setPanel] = useState<PanelTab | undefined>(() => typeof window === 'undefined' ? undefined : storedPanel())
  const [overlay, setOverlay] = useState<OverlayKind | undefined>()
  const choosePanel = (next: PanelTab | undefined) => {
    setPanel(next)
    try { window.localStorage.setItem('mc.officePanel', next ?? 'closed') } catch { /* storage may be blocked */ }
  }
  const chooseView = (next: OfficeView) => {
    setView(next)
    try { window.localStorage.setItem('mc.officeView', next) } catch { /* storage may be blocked */ }
  }
  const show3d = view === '3d' && webgl
  const select3d = (station: OfficeStation, trigger: HTMLElement | null) => { selectedTrigger.current = trigger; setSelectedName(station.name) }
  const counts = Object.fromEntries(ROOMS.map((item) => [item, office?.stations.filter((station) => station.room === item).length ?? 0])) as Record<OfficeRoom, number>
  // Until the viewer picks a room, open wherever the crew currently is.
  const room: OfficeRoom = chosenRoom ?? (counts.Workspace === 0 && counts.Lounge > 0 ? 'Lounge' : 'Workspace')
  const stations = office?.stations.filter((station) => station.room === room) ?? []
  const selected = office?.stations.find((station) => station.name === selectedName)
  const sessions = activity?.sessions
  const channelSource = channels?.channels
  const closeDetail = () => {
    setSelectedName(undefined)
    selectedTrigger.current?.focus()
  }
  if (snapshot.status === 'pending') return <LoadingState message="Reading office state..."/>
  const hud = hudItems(office, dashboard)
  // Hot desking: one unlabeled desk per agent.
  const deskCount = office?.stations.length ?? 0
  const stationButton2d = (station: OfficeStation) => { const badge = officeStateBadge(station.state); const busy = ['Working', 'Reviewing', 'Collaborating'].includes(station.state); return <button className={`pixel-station ${station.roomPosition} state-${station.state.toLowerCase()}`} key={station.id} onClick={(event) => { selectedTrigger.current = event.currentTarget; setSelectedName(station.name) }} aria-label={`${station.name}. ${officeStateLabel(station)}${station.activity ? `: ${station.activity}` : ''}.${taskSummary(station)} Open station details.`} title={station.activity || officeStateLabel(station)}><StationTasks station={station}/>{busy && station.activity && <span className="speech" aria-hidden="true">{station.activity}</span>}<span className="pixel-station-name">{station.name}</span><span className={`badge ${badge.tone}`}>{officeStateLabel(station)}</span>{station.state === 'Unknown' && <span className="neutral-label">NEUTRAL PRESENCE</span>}<PixelCharacter agent={station.id}/></button> }
  const stationButton = (station: OfficeStation) => { const badge = officeStateBadge(station.state); return <button type="button" className="crew-row" key={station.name} onClick={(event) => { selectedTrigger.current = event.currentTarget; setSelectedName(station.name) }} aria-label={`Details for ${station.name}: ${officeStateLabel(station)}`}><PixelCharacter agent={station.id}/><span><strong>{station.name}</strong><small>{station.activity || station.role}</small></span><span className={`badge ${badge.tone}`}>{station.state}</span></button> }
  return <section className={`office-stage view-${show3d ? '3d' : '2d'}`} aria-label="Visual Office">
    <div className="office-hud" role="list" aria-label="Key statistics">{hud.map((item) => { const body = <><span>{item.label}</span><b>{item.value}</b></>; return <div role="listitem" key={item.label}>{item.page && onNavigate ? <button type="button" className={`hud-chip${item.tone ? ` ${item.tone}` : ''}`} title={item.title ?? `Open ${item.page}`} onClick={() => onNavigate(item.page!)}>{body}</button> : <span className={`hud-chip${item.tone ? ` ${item.tone}` : ''}`} title={item.title}>{body}</span>}</div> })}</div>
    <div className="office-stage-tools">
      <div className="view-toggle" role="group" aria-label="Office view">{(['2d', '3d'] as const).map((item) => <button type="button" key={item} className={view === item ? 'active' : ''} aria-pressed={view === item} onClick={() => chooseView(item)} disabled={item === '3d' && !webgl} title={item === '3d' && !webgl ? 'WebGL is not available in this browser' : undefined}>{item.toUpperCase()}</button>)}</div>
      {(['tasks', 'calendar'] as const).map((item) => <button type="button" key={item} className={`panel-toggle${overlay === item ? ' active' : ''}`} aria-pressed={overlay === item} onClick={() => setOverlay(overlay === item ? undefined : item)}>{item === 'tasks' ? '▦ Tasks' : '◷ Calendar'}</button>)}
      <button type="button" className={`panel-toggle${panel ? ' active' : ''}`} aria-expanded={Boolean(panel)} aria-controls="office-panel" onClick={() => choosePanel(panel ? undefined : 'Crew')}>◧ Panel</button>
    </div>
    <div className="office-canvas">
      {show3d ? <SceneBoundary fallback={<section className="empty-state"><h2>3D view unavailable</h2><p>The 3D office could not start on this device. Switch back to 2D.</p></section>}><Suspense fallback={<LoadingState message="Loading the 3D office..."/>}><Office3D stations={office?.stations ?? []} onSelect={select3d}/></Suspense></SceneBoundary> : <>{view === '3d' && !webgl && <p className="muted office-note">3D needs WebGL, which this browser does not provide. Showing 2D.</p>}<div className="room-tabs" role="tablist" aria-label="Office rooms">{ROOMS.map((item) => <button role="tab" aria-selected={room === item} className={room === item ? 'active' : ''} onClick={() => setChosenRoom(item)} key={item}>{item} <span className="room-count">{counts[item]}</span></button>)}</div>
        <div className="room-scroll"><section className={`pixel-room flow ${room.toLowerCase()}`} aria-label={`${room} room`}><div className="room-label"><span>{room}</span><small>{room === 'Workspace' ? `${deskCount} HOT DESK${deskCount === 1 ? '' : 'S'} + MEETING TABLE` : 'QUIET BREAK AREA'}</small></div>
          {room === 'Workspace' ? <>
            <div className="flow-desks">{Array.from({ length: deskCount }, (_, index) => {
              const atDesk = stations.find((station) => station.seat === index + 1 && station.roomPosition !== 'meeting-area')
              return <div className="flow-desk-cell" key={index}>{atDesk && stationButton2d(atDesk)}<div className={`ws-desk${atDesk && atDesk.state !== 'Offline' ? ' occupied' : ''}`} aria-hidden="true"><i/></div></div>
            })}</div>
            <div className="flow-meeting"><div className="meeting-table" aria-hidden="true"><span>MEET</span></div><div className="flow-crew">{stations.filter((station) => station.roomPosition === 'meeting-area').map(stationButton2d)}</div></div>
          </> : <>
            <div className="flow-lounge-props" aria-hidden="true"><div className="pixel-tv"/><div className="lounge-chair"/><div className="lounge-sofa"/><div className="coffee-table"/><div className="lounge-chair"/><div className="pixel-plant"/></div>
            <div className="flow-crew">{stations.map(stationButton2d)}</div>
          </>}
          {room === 'Lounge' && stations.length === 0 && <p className="room-empty">No declared idle presence</p>}
          {room === 'Workspace' && stations.length === 0 && office && <p className="room-empty">Desks are empty · crew is in the Lounge</p>}
        </section></div></>}
      {snapshot.status === 'failed' && <section className="empty-state office-failed"><h2>Not Available</h2><p>The office source could not be reached.</p></section>}
    </div>
    {show3d && <small className="office-3d-hint">Drag to rotate · right-drag, two fingers or Geser to pan · scroll to zoom · click an agent for details</small>}
    {panel && <aside id="office-panel" className="office-panel" aria-label="Office panel" onKeyDown={(event) => { if (event.key === 'Escape' && !selected) { event.stopPropagation(); choosePanel(undefined) } }}>
      <div className="office-panel-head"><div className="panel-tabs" role="tablist" aria-label="Panel">{PANEL_TABS.map((tab) => <button type="button" role="tab" key={tab} aria-selected={panel === tab} className={panel === tab ? 'active' : ''} onClick={() => choosePanel(tab)}>{tab}</button>)}</div><button type="button" className="icon-button" onClick={() => choosePanel(undefined)} aria-label="Close panel">✕</button></div>
      <div className="office-panel-body" role="tabpanel" aria-label={panel}>
        {panel === 'Crew' && <>
          <SourceStatus source={office ? { availability: 'available', data: null } : undefined} fetchedAt={office?.fetchedAt} request={snapshot}/>
          <section className="office-summary"><p className="eyebrow">CREW SNAPSHOT</p><strong>{office?.summary.active ?? 0} active work</strong><span>{office?.summary.idle ?? 0} Idle (managed)</span><span>{office?.summary.unknown ?? 0} Unknown / {office?.summary.offline ?? 0} Offline</span><hr/><span>Gateways running: {office ? `${office.summary.gatewaysReachable} of ${office.summary.gatewaysDeclared}` : 'Not Available'}</span></section>
          <div className="crew-list">{office?.stations.map(stationButton)}</div>
          <small className="muted">Stations show only attributable work. Select one for its evidence and freshness.</small>
        </>}
        {panel === 'Stats' && <Stats dashboard={dashboard ?? null} pending={dashboardPending} onNavigate={onNavigate}/>}
        {panel === 'Activity' && <>
          <section className="office-feed"><p className="eyebrow">LIVE ACTIVITY</p>
            <h2>Active tasks by profile</h2>
            {office?.stations.filter((station) => (station.tasks ?? []).length > 0).map((station) => <article key={station.id}><strong>{station.name}</strong><span>{(station.tasks ?? []).map((task) => `${task.title} (${task.status})`).join(' · ')}</span></article>)}
            {office && office.stations.every((station) => (station.tasks ?? []).length === 0) && <p>No attributed open tasks.</p>}
          </section>
          <section className="office-feed"><p className="eyebrow">LIVE ACTIVITY</p><h2>Unattributed sessions</h2>{sessions?.availability === 'unavailable' ? <p>Not Available</p> : !sessions ? <p>Loading read-only metadata...</p> : sessions.data.length === 0 ? <p>No session metadata available.</p> : sessions.data.slice(0, 5).map((session) => <article key={session.id ?? session.title}><strong>{session.title}</strong><span>{session.lastActive}</span></article>)}<small>Generic session metadata never changes crew state.</small></section>
          <section className="office-feed"><p className="eyebrow">CHANNELS</p><h2>Messaging platforms</h2>{channelSource?.availability === 'unavailable' ? <p>Not Available</p> : !channelSource ? <p>Loading safe status...</p> : channelSource.data.length === 0 ? <p>No configured channels.</p> : channelSource.data.map((channel) => <article key={channel.name}><strong>{channel.name}</strong><span>{channel.status}</span></article>)}{channels?.activeSessions !== undefined && <small>{channels.activeSessions} active session{channels.activeSessions === 1 ? '' : 's'}</small>}</section>
        </>}
      </div>
    </aside>}
    {overlay && <OfficeOverlay kind={overlay} onClose={() => setOverlay(undefined)} onNavigate={onNavigate}/>}
    {selected && <OfficeDetail station={selected} onClose={closeDetail} onDispatched={() => { snapshot.refresh(); activitySnapshot.refresh() }}/>}
  </section>
}
