/**
 * Right-sidebar seat for the terminal workbench.
 *
 * The type, its guide entry and the keyed body/title seats are registered only
 * when the composition provides `sidebarRightTabs`; the conversation tab keeps
 * working in every composition (see index.ts).
 *
 * Every mounted body owns its own terminal engine: the conversation tab and the
 * right sidebar, or two sidebar panes, must never share one xterm instance.
 * What they do share is the UI model (console list, selection, commands) and
 * the Host PTY keyed by console id.
 */

import * as React from 'react'
import { IconTerminal } from './icons.js'
import { NS, type Translate } from './locales.js'
import type { TerminalUiModel } from './model.js'
import { createTerminalView, type TerminalViewHandle } from './terminal.js'
import type { WorkspaceBridge } from './terminals.js'

/** Registration identity; also the keyed-slot key for body and title. */
const ID = 'dsh-cool-terminal'
/** Page kind; deliberately distinct from the built-in `terminal`. */
const KIND = 'cool-terminal'

export interface SidebarDeps {
  readonly ctx: any
  readonly slots: any
  readonly t: Translate
  /** True when the locale service existed at apply time. */
  readonly locale: boolean
  readonly bridge: WorkspaceBridge
  readonly model: TerminalUiModel
}

/**
 * Register the sidebar type and its seats.
 *
 * Safe to call when the service is absent: it simply returns and leaves the
 * conversation tab as the only surface.
 *
 * @param deps - plugin-level collaborators shared by every body.
 */
export function registerSidebarTerminal(deps: SidebarDeps): void {
  const { ctx, slots, t } = deps
  const tabs = ctx.get('sidebarRightTabs')
  if (tabs === undefined || typeof tabs.register !== 'function') return

  // The renderer refuses a slot entry that declares a locale namespace when no
  // locale face is installed, so only name it when the service is present.
  const localeOption = deps.locale ? { locale: NS } : {}

  ctx.effect(
    () => tabs.register({
      id: ID,
      kind: KIND,
      // One page per pane: every open in the same pane reveals the same tab.
      // (`multiple: true` would let a pane host duplicate copies of the same
      // global terminal set, which buys nothing.)
      keepMounted: true,
      title: () => t('view.tab'),
      guide: [{
        id: ID,
        order: 30,
        title: () => t('view.tab'),
        description: () => t('sidebar.guideDescription'),
        icon: IconTerminal,
      }],
    }),
    'dsh-cool-terminal: sidebar tab type',
  )

  ctx.effect(
    () => slots.inject('sidebar.right.pane.tab', () => slots.register({
      name: 'sidebar.right.pane.tab',
      key: ID,
      ...localeOption,
    }, createSidebarBody(deps))),
    'dsh-cool-terminal: sidebar tab body',
  )

  // A live title seat keeps the chip in the current language; the definition's
  // `title` is captured once when the tab is opened and would otherwise stay in
  // whichever language was active at that moment.
  ctx.effect(
    () => slots.inject('sidebar.right.pane.tab.title', () => slots.register({
      name: 'sidebar.right.pane.tab.title',
      key: ID,
      ...localeOption,
    }, createSidebarTitle(t))),
    'dsh-cool-terminal: sidebar tab title',
  )
}

/**
 * Build the body component. One engine per mounted body; `keepMounted` means a
 * hidden session keeps the body (and its engine) alive, while the inner View is
 * unmounted until the tab is visible again.
 */
function createSidebarBody(deps: SidebarDeps): React.ComponentType<any> {
  return function SidebarTerminalBody(props: any): React.ReactElement | null {
    // Hooks must run in a stable order even while the body is hidden.
    const info = typeof props.useTabInfo === 'function' ? props.useTabInfo() : undefined
    // The engine lives in state, not in a ref: it is created in an effect and
    // released in the matching cleanup, so a StrictMode mount → cleanup →
    // mount cycle ends with a live engine instead of a disposed one still
    // being rendered.
    const [engine, setEngine] = React.useState<TerminalViewHandle | null>(null)

    React.useEffect(() => {
      const created = createTerminalView(deps.bridge, deps.t, deps.model, 'sidebar')
      setEngine(created)
      return () => {
        // A surface teardown releases this body's xterm and SSE stream but
        // never the shared PTY: the shell belongs to the console, not to the
        // pane that happened to show it.
        created.disposeSurface()
        setEngine(null)
      }
    }, [])

    if (engine === null) return null
    if (info !== undefined && !info.tab.visible) return null
    const View = engine.View
    return React.createElement(View, { sessionId: props.sessionId })
  }
}

/** Live chip text; the slot re-renders on locale revisions because of `locale`. */
function createSidebarTitle(t: Translate): React.ComponentType<any> {
  return function SidebarTerminalTitle(): React.ReactElement {
    return React.createElement('span', { className: 'dsh-ct-tab-title' }, t('view.tab'))
  }
}
