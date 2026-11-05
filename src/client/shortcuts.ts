/**
 * The Mod+J terminal command: Command+J on macOS, Ctrl+J elsewhere.
 *
 * DSH's shortcut service deliberately refuses single-modifier Web bindings, so
 * it would reject the binding before it could ever appear in the cheatsheet.
 * The requested combination is exactly that key, so this command owns a window
 * listener instead. It consumes the browser default, leaves xterm alone so the
 * shell keeps its input, and leaves modal keyboard handling alone.
 */

import { fetchContext } from './api.js'
import type { TerminalFocusBus, TerminalFocusTarget } from './focus.js'
import type { Translate } from './locales.js'
import type { TerminalUiModel } from './model.js'
import {
  groupKeyForSession,
  lastOrNewTerminal,
  type WorkspaceBridge,
} from './terminals.js'

/** The tab kind registered by `sidebar.tsx`. */
const KIND = 'cool-terminal'

/** The sidebar navigation slice this command needs. */
interface SidebarRightLike {
  commandTarget(element?: Element | null): { readonly sessionId?: unknown } | undefined
  openTabFromTarget(kind: string, target: unknown): void
}

/** The tab registry slice this command probes before consuming the key. */
interface SidebarRightTabsLike {
  get(kind: string): unknown
}

export interface TerminalShortcutDeps {
  readonly ctx: any
  readonly t: Translate
  readonly model: TerminalUiModel
  readonly bridge: WorkspaceBridge
  readonly focus: TerminalFocusBus
}

/**
 * Install the Ctrl+J listener for the lifetime of the plugin.
 * @param deps - shared collaborators owned by the client entry.
 * @returns the disposer removing the listener and cancelling late lookups.
 */
export function registerTerminalShortcut(deps: TerminalShortcutDeps): () => void {
  let alive = true

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!alive || !isTerminalShortcut(event)) return
    if (event.repeat || isInsideTerminal(event.target) || isInsideModal(event.target)) return

    const sidebar = deps.ctx.get('sidebarRight') as SidebarRightLike | undefined
    const tabs = deps.ctx.get('sidebarRightTabs') as SidebarRightTabsLike | undefined
    if (sidebar === undefined || tabs === undefined) return
    if (typeof sidebar.commandTarget !== 'function' || typeof sidebar.openTabFromTarget !== 'function') return
    if (typeof tabs.get !== 'function' || tabs.get(KIND) === undefined) return

    // From here on the key belongs to this command: without preventDefault the
    // browser opens its download panel.
    event.preventDefault()

    const target = sidebar.commandTarget(event.target instanceof Element ? event.target : undefined)
    if (target === undefined) return
    const sessionId = typeof target.sessionId === 'string' ? target.sessionId : undefined
    // The workbench can be visible in the conversation tab; then Ctrl+J only
    // needs to move focus there instead of opening the same consoles again in
    // the right sidebar.
    const surface = currentSurface()

    // Workspace membership answers synchronously, which is the common case.
    // Selecting before the tab mounts keeps the sidebar from briefly starting
    // the console that happened to be restored from the last visit.
    const immediateKey = groupKeyForSession(deps.bridge.getSnapshot().items, sessionId, '')
    if (immediateKey !== undefined) activateGroup(deps, immediateKey, surface)

    if (surface === 'sidebar') {
      try {
        sidebar.openTabFromTarget(KIND, target)
      } catch {
        // The tab type left while the listener was in flight; nothing to open.
        return
      }
    }
    if (immediateKey === undefined) void activateFromDirectory(deps, sessionId, surface, () => alive)
  }

  window.addEventListener('keydown', onKeyDown, true)
  return () => {
    alive = false
    window.removeEventListener('keydown', onKeyDown, true)
  }
}

/**
 * True for the physical Mod+J chord on this platform.
 *
 * `code` is the physical key so the binding survives non-Latin layouts; the
 * `key` fallback covers synthetic events that do not carry a code. macOS uses
 * Command, matching the platform's shortcut convention; every other platform
 * uses Control.
 * @param event - candidate keyboard event.
 * @returns whether this is the unmodified Mod+J chord.
 */
function isTerminalShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing) return false
  if (event.altKey || event.shiftKey) return false
  if (isMacPlatform()) {
    if (!event.metaKey || event.ctrlKey) return false
  } else if (!event.ctrlKey || event.metaKey) {
    return false
  }
  return event.code === 'KeyJ' || (typeof event.key === 'string' && event.key.toLowerCase() === 'j')
}

/** Whether this browser runs on macOS, where Command, not Control, is the modifier. */
function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.platform
  if (typeof platform === 'string' && platform !== '') return platform.startsWith('Mac')
  return /Macintosh|Mac OS X/i.test(navigator.userAgent)
}

/** A console owns the chord while focus is inside xterm; the shell keeps its input. */
function isInsideTerminal(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.xterm') !== null
}

/** A modal owns the keyboard; Ctrl+J must not reach behind it. */
function isInsideModal(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('dialog[open], [role="dialog"]') !== null
}

/**
 * The terminal surface the user is already looking at, if any.
 *
 * The conversation tab and the right sidebar mount the same workbench; opening
 * the sidebar when the conversation tab already shows it would duplicate every
 * console on screen. The focused surface wins when both are visible, otherwise
 * the dedicated sidebar panel does; with neither visible the sidebar is where
 * this command opens one.
 * @returns the surface that should receive the next selection and focus.
 */
function currentSurface(): TerminalFocusTarget {
  const sidebar = visibleSurface('sidebar')
  const conversation = visibleSurface('conversation')
  const active = document.activeElement
  if (sidebar !== null && active instanceof Node && sidebar.contains(active)) return 'sidebar'
  if (conversation !== null && active instanceof Node && conversation.contains(active)) return 'conversation'
  if (sidebar !== null) return 'sidebar'
  return conversation === null ? 'sidebar' : 'conversation'
}

/** A mounted and on-screen root of one terminal surface. */
function visibleSurface(surface: TerminalFocusTarget): HTMLElement | null {
  const element = document.querySelector(`[data-dsh-ct-surface="${surface}"]`)
  if (!(element instanceof HTMLElement)) return null
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  const onScreen = rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth
  return onScreen ? element : null
}

/**
 * Resolve a session outside every Workspace through its own workdir, then
 * activate the group that directory names.
 *
 * The Host lookup is asynchronous, so the sidebar may have mounted first; the
 * model update still renders the choice there. It is only needed for sessions
 * the Workspace list does not claim.
 * @param deps - shared collaborators.
 * @param sessionId - the on-screen session.
 * @param alive - false once the plugin's listener has been disposed.
 */
async function activateFromDirectory(
  deps: TerminalShortcutDeps,
  sessionId: string | undefined,
  surface: TerminalFocusTarget,
  alive: () => boolean,
): Promise<void> {
  if (sessionId === undefined) return
  const context = await fetchContext(sessionId)
  if (!alive()) return
  const cwd = context.ok && typeof context.workdir === 'string' ? context.workdir : ''
  const key = groupKeyForSession(deps.bridge.getSnapshot().items, sessionId, cwd)
  if (key === undefined || !alive()) return
  activateGroup(deps, key, surface)
}

/**
 * Select a group's last console — creating one when the group is empty — and
 * ask the addressed surface to move keyboard focus into it.
 * @param deps - shared collaborators.
 * @param key - the group the shortcut is opening.
 * @param surface - the terminal surface the user is looking at.
 */
function activateGroup(deps: TerminalShortcutDeps, key: string, surface: TerminalFocusTarget): void {
  const current = deps.model.getSnapshot()
  const { account, terminal } = lastOrNewTerminal(
    current.account,
    key,
    (number) => deps.t('terminal.autoTitle', { n: number }),
  )
  if (account !== current.account) deps.model.setAccount(account)
  deps.model.setSelection({ key, terminalId: terminal.id })
  deps.model.setExpanded((keys) => keys.includes(key) ? keys : [...keys, key])
  deps.model.setSidebarCollapsed(false)
  deps.focus.request(surface)
}