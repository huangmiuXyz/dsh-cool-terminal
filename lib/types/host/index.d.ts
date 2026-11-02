/**
 * Host entry for dsh-cool-terminal.
 *
 * The browser half owns the terminal UI. Every keystroke and every byte of
 * output crosses back to this half over same-origin HTTP routes, because an
 * out-of-tree bundle cannot generate a `ctx.remote` namespace and its Client
 * half never sees the Host Cordis context.
 *
 * The terminal itself is a real PTY obtained from the `subprocess` seam
 * (`spawnTerminal`): this half only owns the registry, the bounded replay
 * buffer, and the SSE fan-out. Sizing starts from the browser's measurement
 * and follows it afterwards — a surface that shows the console reports its
 * grid through the `/resize` route, so the shell matches the pane it is in.
 */
export declare const name = "dsh-cool-terminal";
/** The web carrier is a hard dependency: without it there is no route to serve. */
export declare const inject: string[];
/** Route table, kept in one place so both halves cannot drift. */
export declare const ROUTES: {
    readonly context: "/dsh-cool-terminal/api/context";
    readonly open: "/dsh-cool-terminal/api/open";
    readonly stream: "/dsh-cool-terminal/api/stream";
    readonly input: "/dsh-cool-terminal/api/input";
    readonly signal: "/dsh-cool-terminal/api/signal";
    readonly close: "/dsh-cool-terminal/api/close";
    readonly openFolder: "/dsh-cool-terminal/api/open-folder";
    readonly resize: "/dsh-cool-terminal/api/resize";
};
export declare function apply(ctx: any): void;
//# sourceMappingURL=index.d.ts.map