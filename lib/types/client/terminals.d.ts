/**
 * Terminal-group model for the terminal tab.
 *
 * The Workspace list itself belongs to the Host and is read live from the
 * Client `workspaces` service (see {@link createWorkspaceBridge}); this module
 * owns only the part the Host does not know about: which named consoles each
 * Workspace group holds, their titles, and the tiny account persisted across
 * page reloads. Every list operation is pure so the React half can treat the
 * account as immutable state.
 */
/** One named console inside a Workspace (or session) group. */
export interface TerminalDef {
    readonly id: string;
    readonly title: string;
}
/** Console lists keyed by Workspace id, plus the session fallback key. */
export type TerminalAccount = Readonly<Record<string, readonly TerminalDef[]>>;
/** Group key of the pseudo console bound to the session's own workdir. */
export declare const SESSION_KEY = "__session__";
/**
 * Compare directory spellings that differ only by trailing separators.
 *
 * The Host reports a Workspace path and a session workdir independently;
 * `/work` and `/work/` are the same directory for the grouping decision. An
 * all-separator path stays as written so `/` never normalizes away.
 * @param value - path to compare.
 * @returns the path without trailing separators.
 */
export declare function normalizePath(value: string): string;
/** The active console: its group key plus the console id inside it. */
export interface TerminalSelection {
    readonly key: string;
    readonly terminalId: string;
}
/**
 * Read a group's consoles. Groups start empty by design: nothing is seeded,
 * so an unknown group and an emptied group both answer `[]`.
 * @param account - current account.
 * @param key - group key.
 * @returns a fresh array the caller may replace.
 */
export declare function terminalsFor(account: TerminalAccount, key: string): TerminalDef[];
/**
 * Replace one group's console list, leaving the other groups shared.
 * @param account - current account.
 * @param key - group key.
 * @param list - the group's next console list.
 * @returns the next account.
 */
export declare function withTerminalList(account: TerminalAccount, key: string, list: readonly TerminalDef[]): TerminalAccount;
/**
 * Append a console named with the next free number.
 *
 * The title is minted by the caller, which owns the language: this module has
 * no translator, and a console's name is user data once it has been written.
 * @param list - current group list.
 * @param key - group key.
 * @param titleOf - the name for one auto-numbered console.
 * @returns the next group list.
 */
export declare function addTerminal(list: readonly TerminalDef[], key: string, titleOf?: (number: number) => string): TerminalDef[];
/** The console a one-key activation lands on, plus the account holding it. */
export interface LastTerminalChoice {
    readonly account: TerminalAccount;
    readonly terminal: TerminalDef;
}
/**
 * Pick the last console in one group, minting one when the group is empty.
 *
 * "Last" is list order, which is also creation order until the user drags a
 * row: the newest console is what a one-key open should land on. The account
 * identity is preserved when nothing was created, so the caller can skip
 * persisting and notifying.
 * @param account - current account.
 * @param key - group key.
 * @param titleOf - the name for a newly created console.
 * @returns the (possibly extended) account and the console to select.
 */
export declare function lastOrNewTerminal(account: TerminalAccount, key: string, titleOf?: (number: number) => string): LastTerminalChoice;
/**
 * Rename one console; blank input is ignored rather than stored.
 * @param list - current group list.
 * @param id - console to rename.
 * @param title - requested title.
 * @returns the next group list.
 */
export declare function renameTerminal(list: readonly TerminalDef[], id: string, title: string): TerminalDef[];
/**
 * Remove one console. Any console may go, including a group's last one: the
 * group then simply holds none until the user adds another.
 * @param list - current group list.
 * @param id - console to remove.
 * @returns the next group list.
 */
export declare function removeTerminal(list: readonly TerminalDef[], id: string): TerminalDef[];
/**
 * Move one console to another position inside its own group.
 *
 * Drag-and-drop only ever reorders within the group a console belongs to, so
 * this takes no group key: the caller hands in the one group's list. `toIndex`
 * is an *insertion* index into the current list — "before the row now at that
 * index" — so the valid range is `0..list.length`, and `list.length` means
 * "after the last row". Positions outside that range clamp to the nearest
 * end; dropping a console onto its own slot (before or right after itself)
 * is a harmless no-op that still returns a fresh array.
 * @param list - current group list.
 * @param id - console to move.
 * @param toIndex - insertion index into the current list.
 * @returns the next group list.
 */
export declare function moveTerminal(list: readonly TerminalDef[], id: string, toIndex: number): TerminalDef[];
/**
 * Read the persisted account, dropping anything that does not match the shape
 * (a hand-edited or older entry must not break the tab).
 * @param fallbackTitle - the name a console with no title is repaired to.
 * @returns the validated account, or an empty one.
 */
export declare function loadAccount(fallbackTitle?: string): TerminalAccount;
/**
 * Persist the account. Storage failures (quota, blocked third-party storage)
 * are not worth surfacing: the consoles keep working for this page's lifetime.
 * @param account - account to persist.
 */
export declare function saveAccount(account: TerminalAccount): void;
/**
 * Read the persisted expanded group keys.
 *
 * Only expansion is stored: a group missing from the list is collapsed, which
 * makes "collapsed" the state every group starts in.
 * @returns the validated keys, or an empty list.
 */
export declare function loadExpanded(): string[];
/**
 * Persist the expanded group keys.
 * @param keys - group keys currently expanded.
 */
export declare function saveExpanded(keys: readonly string[]): void;
/**
 * Read the persisted active console.
 *
 * This is what makes a reload reopen the console the user was last using
 * instead of the first console of the first group.
 * @returns the validated selection, or null when absent or malformed.
 */
export declare function loadSelection(): TerminalSelection | null;
/**
 * Persist the active console; an empty selection drops the entry, so a tab
 * with nothing selected does not resurrect a stale console.
 * @param selection - active console, or null.
 */
export declare function saveSelection(selection: TerminalSelection | null): void;
/**
 * Read whether the terminal sidebar is collapsed.
 *
 * The sidebar starts expanded: collapsing it is a deliberate way to give the
 * console more room, and an absent preference should not hide the user's
 * terminals on the first visit.
 *
 * @returns true when the sidebar is collapsed.
 */
export declare function loadSidebarCollapsed(): boolean;
/**
 * Persist whether the terminal sidebar is collapsed.
 * @param collapsed - true when the sidebar is collapsed.
 */
export declare function saveSidebarCollapsed(collapsed: boolean): void;
/** The Live Workspace row fields this UI reads. */
export interface WorkspaceRow {
    readonly workspaceId: string;
    readonly path: string;
    readonly title: string;
    /** Session membership, read only to answer "which Workspace is current". */
    readonly sessionIds?: readonly string[];
}
/** The fields that decide which group a session's terminals belong to. */
export interface WorkspaceMembershipLike {
    readonly workspaceId: string;
    readonly path: string;
    readonly sessionIds?: readonly string[];
}
/**
 * The sidebar group a session's terminals belong to.
 *
 * Workspace membership wins because "current workspace" means the project the
 * conversation lives in, not whichever subdirectory a shell happens to sit
 * in. Only a session outside every Workspace falls back to the directory: an
 * exact Workspace path names that Workspace, and any other directory is the
 * session-only group whose key is {@link SESSION_KEY} — the same two rules
 * that decide which rows the sidebar shows.
 * @param items - live Workspace rows.
 * @param sessionId - the session being opened for, when known.
 * @param cwd - the session's own workdir, when known.
 * @returns the group key, or undefined when neither source names one.
 */
export declare function groupKeyForSession(items: readonly WorkspaceMembershipLike[], sessionId: string | undefined, cwd: string): string | undefined;
/** The part of a Workspace snapshot this UI reads. */
export interface WorkspaceSnapshotLike {
    readonly items: readonly WorkspaceRow[];
}
/**
 * The bare observable the Client `workspaces` service exposes as `.list`.
 * Declared structurally so this package needs no module dependency on the
 * controller package.
 */
export interface WorkspaceSourceLike {
    getSnapshot(): WorkspaceSnapshotLike;
    subscribe(listener: () => void): () => void;
}
/**
 * Late-bound subscription to the Workspace service.
 *
 * The terminal tab must exist even in a composition that never provides the
 * service, so the plugin attaches through a child fiber and this bridge holds
 * the service when it appears. `getSnapshot` always returns the same object
 * while nothing changed, which is what `useSyncExternalStore` requires.
 */
export interface WorkspaceBridge {
    attach(source: WorkspaceSourceLike): () => void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): WorkspaceSnapshotLike;
}
/**
 * Create the late-bound Workspace bridge.
 *
 * The bridge owns the snapshot identity React needs: `useSyncExternalStore`
 * loops forever when `getSnapshot` answers a fresh object every call, and a
 * source is only obliged to be correct, not identity-stable. The cached
 * snapshot is refreshed exactly on attach and on a source notification.
 *
 * @returns a bridge safe to read before any service has attached.
 */
export declare function createWorkspaceBridge(): WorkspaceBridge;
//# sourceMappingURL=terminals.d.ts.map