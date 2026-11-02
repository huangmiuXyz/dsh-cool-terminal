/**
 * One shared UI model for every terminal surface.
 *
 * The account (console lists), the active console, the expanded groups, the
 * sidebar visibility and the common-command list are browser state, not xterm
 * state: the conversation tab
 * and every right-sidebar body must see and edit the same values. Each surface
 * keeps its own xterm/SSE runtimes (see terminal.tsx), but all of them read and
 * write this single snapshot.
 */

import {
  loadAccount,
  loadExpanded,
  loadSelection,
  loadSidebarCollapsed,
  saveAccount,
  saveExpanded,
  saveSelection,
  saveSidebarCollapsed,
  type TerminalAccount,
  type TerminalSelection,
} from './terminals.js'
import { loadCommands, saveCommands, type CommandDef } from './commands.js'

export interface TerminalUiState {
  readonly account: TerminalAccount
  readonly selection: TerminalSelection | null
  readonly expanded: readonly string[]
  /** Whether the terminal sidebar is collapsed to its narrow icon rail. */
  readonly sidebarCollapsed: boolean
  readonly commands: readonly CommandDef[]
}

/** A value or a functional update, mirroring React's `useState` setter shape. */
export type UiUpdater<T> = T | ((current: T) => T)

export interface TerminalUiModel {
  getSnapshot(): TerminalUiState
  subscribe(listener: () => void): () => void
  setAccount(next: UiUpdater<TerminalAccount>): void
  setSelection(next: UiUpdater<TerminalSelection | null>): void
  setExpanded(next: UiUpdater<readonly string[]>): void
  setSidebarCollapsed(next: UiUpdater<boolean>): void
  setCommands(next: UiUpdater<readonly CommandDef[]>): void
}

function resolve<T>(current: T, next: UiUpdater<T>): T {
  return typeof next === 'function' ? (next as (value: T) => T)(current) : next
}

/**
 * Build the plugin-lifetime model. Loads persisted state once; every setter
 * persists synchronously and notifies every mounted surface.
 *
 * @param fallbackTitle - title for a console whose stored title is missing.
 */
export function createTerminalUiModel(fallbackTitle: string): TerminalUiModel {
  let state: TerminalUiState = {
    account: loadAccount(fallbackTitle),
    selection: loadSelection(),
    expanded: loadExpanded(),
    sidebarCollapsed: loadSidebarCollapsed(),
    commands: loadCommands(),
  }
  const listeners = new Set<() => void>()

  const commit = (next: TerminalUiState): void => {
    if (next === state) return
    state = next
    for (const listener of [...listeners]) listener()
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setAccount(next) {
      const account = resolve(state.account, next)
      if (account === state.account) return
      saveAccount(account)
      commit({ ...state, account })
    },
    setSelection(next) {
      const selection = resolve(state.selection, next)
      if (selection === state.selection) return
      saveSelection(selection)
      commit({ ...state, selection })
    },
    setExpanded(next) {
      const expanded = resolve(state.expanded, next)
      if (expanded === state.expanded) return
      saveExpanded(expanded)
      commit({ ...state, expanded })
    },
    setSidebarCollapsed(next) {
      const sidebarCollapsed = resolve(state.sidebarCollapsed, next)
      if (sidebarCollapsed === state.sidebarCollapsed) return
      saveSidebarCollapsed(sidebarCollapsed)
      commit({ ...state, sidebarCollapsed })
    },
    setCommands(next) {
      const commands = resolve(state.commands, next)
      if (commands === state.commands) return
      saveCommands(commands)
      commit({ ...state, commands })
    },
  }
}
