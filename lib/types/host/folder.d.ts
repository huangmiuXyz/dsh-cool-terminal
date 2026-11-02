/**
 * Host-side helpers for opening a terminal's current directory.
 *
 * The terminal's process is the authority for its current directory: a shell
 * may have moved with `cd`, so the directory it was started in is not enough.
 * POSIX hosts expose that directory through the process itself (`/proc` on
 * Linux and `lsof` on macOS); other hosts fall back to the initial workdir.
 *
 * Opening the directory is a user-facing desktop action, so it uses the
 * platform's file manager directly. The path is passed as an argument rather
 * than through a shell, and is checked to be an existing directory first.
 */
/** One command that asks the operating system to open a directory. */
export interface FolderOpener {
    readonly command: string;
    readonly args: readonly string[];
}
/**
 * Parse the directory named by `lsof -Fn` output.
 *
 * `lsof` prints one field per line: `p<pid>`, `f<descriptor>`, and
 * `n<name>`. The `cwd` descriptor's name is the process's current directory.
 * The last `n` line wins because a process can own more than one matching
 * file descriptor in unusual cases.
 *
 * @param output - raw `lsof -Fn` stdout.
 * @returns the directory, or undefined when the output has no `cwd` name.
 */
export declare function parseLsofCwd(output: string): string | undefined;
/**
 * Read a Linux process's current directory from `/proc`.
 *
 * @param pid - process id.
 * @returns the directory, or undefined when `/proc` cannot answer.
 */
export declare function linuxProcessCwd(pid: number): string | undefined;
/**
 * Ask `lsof` for a process's current directory.
 *
 * @param pid - process id.
 * @returns the directory, or undefined when the probe fails.
 */
export declare function lsofProcessCwd(pid: number): Promise<string | undefined>;
/**
 * Resolve the directory a live terminal is currently in.
 *
 * The process id is the shell's own pid, so this follows the shell across
 * `cd` without sending anything to the PTY or disturbing what the user is
 * typing. Hosts that cannot observe the process directory fall back to the
 * workdir the terminal started in.
 *
 * @param pid - terminal shell process id.
 * @param fallback - the terminal's initial workdir.
 * @returns an absolute directory path.
 */
export declare function terminalCwd(pid: number, fallback: string): Promise<string>;
/**
 * Resolve and validate a directory before it is handed to the file manager.
 *
 * @param path - candidate directory.
 * @returns its canonical absolute path.
 * @throws when the path is missing or is not a directory.
 */
export declare function requireDirectory(path: string): string;
/**
 * The platform command that opens a directory in its desktop file manager.
 *
 * @param platform - Node platform identifier.
 * @param path - directory to open.
 * @returns the command and its argument vector.
 */
export declare function folderOpener(platform: NodeJS.Platform, path: string): FolderOpener;
/**
 * Open a directory in the platform's file manager.
 *
 * The child is detached and does not inherit the Harness stdio: the file
 * manager is a desktop application, not part of the Host's process tree, and
 * the Host must not wait for it to close.
 *
 * @param path - directory to open.
 * @returns once the file-manager process has started.
 */
export declare function openDirectory(path: string): Promise<void>;
//# sourceMappingURL=folder.d.ts.map