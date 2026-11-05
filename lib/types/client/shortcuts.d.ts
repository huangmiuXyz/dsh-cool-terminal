/**
 * The Ctrl+J terminal command.
 *
 * DSH's shortcut service deliberately refuses single-modifier Web bindings:
 * Ctrl+J is the browser's download panel, and the service rejects it as an
 * unsupported Web default before it could ever appear in the cheatsheet. The
 * requested binding is exactly that key, so this command owns a window listener
 * instead. It consumes the browser default, stays away from xterm (where
 * Ctrl+J is a line feed for the shell), and leaves modal keyboard handling
 * alone.
 */
import type { TerminalFocusBus } from './focus.js';
import type { Translate } from './locales.js';
import type { TerminalUiModel } from './model.js';
import { type WorkspaceBridge } from './terminals.js';
export interface TerminalShortcutDeps {
    readonly ctx: any;
    readonly t: Translate;
    readonly model: TerminalUiModel;
    readonly bridge: WorkspaceBridge;
    readonly focus: TerminalFocusBus;
}
/**
 * Install the Ctrl+J listener for the lifetime of the plugin.
 * @param deps - shared collaborators owned by the client entry.
 * @returns the disposer removing the listener and cancelling late lookups.
 */
export declare function registerTerminalShortcut(deps: TerminalShortcutDeps): () => void;
//# sourceMappingURL=shortcuts.d.ts.map