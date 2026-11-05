/**
 * Bilingual copy for the terminal tab.
 *
 * Every user-visible string this package owns is declared here and resolved
 * through the Client `locale` service, so the tab follows the GUI's language
 * switch instead of freezing the language it was first rendered in. The two
 * dictionaries are one key set — the Chinese half is typed against the English
 * one, which makes a key added on one side and forgotten on the other a
 * compile error rather than a key name shown to the user.
 */
/** The namespace these dictionaries occupy in the Client locale registry. */
export declare const NS = "dsh-cool-terminal";
/** English copy: the key set's source of truth. */
export declare const en: {
    readonly 'view.tab': "Terminal";
    readonly 'sidebar.session': "Current session";
    readonly 'sidebar.collapse': "Collapse sidebar";
    readonly 'sidebar.expand': "Expand sidebar";
    readonly 'sidebar.empty': "No workspaces";
    readonly 'sidebar.new': "New terminal";
    readonly 'sidebar.terminalCount': "{count} terminals";
    readonly 'sidebar.guideDescription': "A shared terminal workspace, grouped by project";
    readonly 'main.hint': "Click ＋ on a workspace on the left to open a terminal";
    readonly 'terminal.untitled': "Terminal";
    readonly 'terminal.autoTitle': "Terminal {n}";
    readonly 'terminal.rename': "Rename";
    readonly 'terminal.remove': "Delete";
    readonly 'terminal.close': "Close terminal";
    readonly 'terminal.openFolder': "Open current directory";
    readonly 'terminal.openFolderFailed': "Could not open the current directory: {detail}";
    readonly 'terminal.more': "More actions";
    readonly 'terminal.ended': "Ended";
    readonly 'terminal.exitCode': "Exit code {code}";
    readonly 'terminal.signal': "Signal {signal}";
    readonly 'terminal.unknown': "Unknown error";
    readonly 'terminal.startFailed': "Could not start the terminal: {detail}";
    readonly 'terminal.endedBanner': "[Terminal ended: {detail}]";
    readonly 'terminal.reason.outputFailed': "the output stream failed";
    readonly 'commands.title': "Commands";
    readonly 'commands.description': "Click a command to type it into the active terminal, or use the inline actions to manage it.";
    readonly 'commands.search': "Search";
    readonly 'commands.searchLabel': "Search commands";
    readonly 'commands.add': "Add command";
    readonly 'commands.bodyPlaceholder': "Command, e.g. pnpm dev";
    readonly 'commands.descriptionPlaceholder': "Description (optional)";
    readonly 'commands.noDescription': "No description";
    readonly 'commands.empty': "No saved commands yet — click \"Add command\" to create one";
    readonly 'commands.noMatch': "No matching commands";
    readonly 'commands.insertHint': "Insert into the active terminal";
    readonly 'commands.noActiveTerminal': "No active terminal";
    readonly 'commands.edit': "Edit";
    readonly 'commands.copy': "Copy";
    readonly 'commands.remove': "Delete";
    readonly 'commands.copied': "Copied";
    readonly 'commands.cancel': "Cancel";
    readonly 'commands.save': "Save";
    readonly 'commands.close': "Close";
    readonly 'completion.footer': "↑↓ select · Enter fill · Esc close";
    readonly 'shortcut.open': "Open or focus the current workspace terminal";
    readonly 'shortcut.noSession': "This shortcut needs an open session";
    readonly 'shortcut.unavailable': "The terminal panel is unavailable";
};
/** Simplified Chinese copy; must cover every English key. */
export declare const zh: Record<keyof typeof en, string>;
/** One translatable key of this package. */
export type LocaleKey = keyof typeof en;
/** Values substituted into a template's `{name}` placeholders. */
export type LocaleParams = Record<string, string | number>;
/**
 * A bound translator.
 *
 * Reads the active dictionary at call time, so a function that holds one (a
 * stream handler, the tab-label thunk) speaks whatever language is in force
 * when it runs.
 */
export type Translate = (key: LocaleKey, params?: LocaleParams) => string;
/**
 * The slice of the Client `locale` service this package uses.
 *
 * Declared structurally so this package needs no module dependency on the
 * locale package, the same way `WorkspaceSourceLike` stands in for the
 * Workspace controller.
 */
export interface LocaleServiceLike {
    /** Register a namespace's built-in dictionaries; returns their disposer. */
    register(ns: string, dicts: {
        zh: Record<string, string>;
        en: Record<string, string>;
    }): () => void;
    /** Bind a namespace to a translator that reads the active locale per call. */
    bind(ns: string): (key: string, params?: LocaleParams) => string;
}
/**
 * The translator a composition without the locale service falls back to.
 *
 * It answers Chinese for a browser that asks for a `zh*` language and English
 * otherwise — the same two languages the service ships, resolved without it.
 */
export declare function browserTranslate(): Translate;
/**
 * A translator bound to the Client locale service.
 *
 * Interpolation is the service's own, so a parameter value is never substituted
 * a second time.
 */
export declare function serviceTranslate(locale: LocaleServiceLike): Translate;
//# sourceMappingURL=locales.d.ts.map