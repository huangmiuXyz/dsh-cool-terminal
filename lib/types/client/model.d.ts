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
import { type TerminalAccount, type TerminalSelection } from './terminals.js';
import { type CommandDef } from './commands.js';
export interface TerminalUiState {
    readonly account: TerminalAccount;
    readonly selection: TerminalSelection | null;
    readonly expanded: readonly string[];
    /** Whether the terminal sidebar is collapsed to its narrow icon rail. */
    readonly sidebarCollapsed: boolean;
    readonly commands: readonly CommandDef[];
}
/** A value or a functional update, mirroring React's `useState` setter shape. */
export type UiUpdater<T> = T | ((current: T) => T);
export interface TerminalUiModel {
    getSnapshot(): TerminalUiState;
    subscribe(listener: () => void): () => void;
    setAccount(next: UiUpdater<TerminalAccount>): void;
    setSelection(next: UiUpdater<TerminalSelection | null>): void;
    setExpanded(next: UiUpdater<readonly string[]>): void;
    setSidebarCollapsed(next: UiUpdater<boolean>): void;
    setCommands(next: UiUpdater<readonly CommandDef[]>): void;
}
/**
 * Build the plugin-lifetime model. Loads persisted state once; every setter
 * persists synchronously and notifies every mounted surface.
 *
 * @param fallbackTitle - title for a console whose stored title is missing.
 */
export declare function createTerminalUiModel(fallbackTitle: string): TerminalUiModel;
//# sourceMappingURL=model.d.ts.map