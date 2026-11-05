/**
 * The Mod+J terminal command: Command+J on macOS, Ctrl+J elsewhere.
 *
 * DSH's shortcut service deliberately refuses single-modifier Web bindings, so
 * it would reject the binding before it could ever appear in the cheatsheet.
 * The requested combination is exactly that key, so this command owns a window
 * listener instead. It consumes the browser default, leaves xterm alone so the
 * shell keeps its input, and leaves modal keyboard handling alone.
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