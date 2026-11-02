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
import { type Translate } from './locales.js';
import type { TerminalUiModel } from './model.js';
import type { WorkspaceBridge } from './terminals.js';
export interface SidebarDeps {
    readonly ctx: any;
    readonly slots: any;
    readonly t: Translate;
    /** True when the locale service existed at apply time. */
    readonly locale: boolean;
    readonly bridge: WorkspaceBridge;
    readonly model: TerminalUiModel;
}
/**
 * Register the sidebar type and its seats.
 *
 * Safe to call when the service is absent: it simply returns and leaves the
 * conversation tab as the only surface.
 *
 * @param deps - plugin-level collaborators shared by every body.
 */
export declare function registerSidebarTerminal(deps: SidebarDeps): void;
//# sourceMappingURL=sidebar.d.ts.map