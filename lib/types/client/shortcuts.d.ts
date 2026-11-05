/**
 * The Mod+J terminal command: Command+J on macOS, Ctrl+J on Windows.
 *
 * DSH's shortcut service owns desktop keyboard dispatch, and on macOS and
 * Windows it accepts single-modifier bindings and publishes the command in the
 * cheatsheet, so those platforms register through `ctx.shortcuts`.
 *
 * The Web runtime rejects single-modifier Web bindings, and this command has no
 * default on desktop Linux, so those two runtimes use a window listener. It
 * consumes the browser default, leaves xterm alone so the shell keeps its
 * input, and leaves modal keyboard handling alone.
 */
import type { TerminalFocusBus } from './focus.js';
import type { Translate } from './locales.js';
import type { TerminalUiModel } from './model.js';
import { type WorkspaceBridge } from './terminals.js';
/** The slice of the Client `shortcuts` service this command registers into. */
interface ShortcutsLike {
    register(command: {
        id: string;
        label: () => string;
        aliases: readonly string[];
        defaults: Record<string, {
            code: string;
            modifiers: readonly string[];
        }>;
        regions: readonly string[];
        modals: readonly string[];
        resolve(context: {
            target?: Element | null;
        }): {
            status: 'handled';
            run: () => void;
        } | {
            status: 'blocked';
            reason: string;
        } | {
            status: 'pass';
        };
    }): () => void;
}
export interface TerminalShortcutDeps {
    readonly ctx: any;
    readonly t: Translate;
    readonly model: TerminalUiModel;
    readonly bridge: WorkspaceBridge;
    readonly focus: TerminalFocusBus;
}
/** Dependencies of the shortcut-service command, which also needs its registry. */
export interface TerminalCommandDeps extends TerminalShortcutDeps {
    readonly shortcuts: ShortcutsLike;
}
/**
 * Install the window-listener fallback for runtimes where the shortcut service
 * cannot bind the chord.
 *
 * macOS and Windows Desktop register through {@link registerTerminalCommand}
 * instead; the fallback would duplicate them there.
 * @param deps - shared collaborators owned by the client entry.
 * @returns the disposer removing the listener and cancelling late lookups.
 */
export declare function registerTerminalShortcut(deps: TerminalShortcutDeps): () => void;
/**
 * Register the command with DSH's shortcut service on macOS and Windows
 * Desktop, so it appears in the keyboard-shortcuts cheatsheet and obeys the
 * user's keymap.
 *
 * Both defaults are single-modifier bindings, which the service only accepts
 * from the Desktop runtime; the Web and Linux paths use the window listener.
 * @param deps - shared collaborators plus the shortcut registry.
 * @returns the disposer unregistering the command and cancelling late lookups.
 */
export declare function registerTerminalCommand(deps: TerminalCommandDeps): () => void;
export {};
//# sourceMappingURL=shortcuts.d.ts.map