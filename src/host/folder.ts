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

import { execFile, spawn } from 'node:child_process'
import { readlinkSync, realpathSync, statSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Bounds for the short-lived directory probe. */
const PROBE_TIMEOUT_MS = 2_000
const PROBE_MAX_BUFFER = 64 * 1024

/** One command that asks the operating system to open a directory. */
export interface FolderOpener {
  readonly command: string
  readonly args: readonly string[]
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
export function parseLsofCwd(output: string): string | undefined {
  let cwd: string | undefined
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith('n')) continue
    const name = line.slice(1)
    if (name !== '') cwd = name
  }
  return cwd
}

/**
 * Read a Linux process's current directory from `/proc`.
 *
 * @param pid - process id.
 * @returns the directory, or undefined when `/proc` cannot answer.
 */
export function linuxProcessCwd(pid: number): string | undefined {
  try {
    const path = readlinkSync(`/proc/${pid}/cwd`)
    return path === '' ? undefined : path
  } catch {
    return undefined
  }
}

/**
 * Ask `lsof` for a process's current directory.
 *
 * @param pid - process id.
 * @returns the directory, or undefined when the probe fails.
 */
export async function lsofProcessCwd(pid: number): Promise<string | undefined> {
  const candidates = ['/usr/sbin/lsof', '/usr/bin/lsof', 'lsof']
  for (const command of candidates) {
    try {
      const result = await execFileAsync(command, ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
        encoding: 'utf8',
        timeout: PROBE_TIMEOUT_MS,
        maxBuffer: PROBE_MAX_BUFFER,
      })
      const cwd = parseLsofCwd(String(result.stdout))
      if (cwd !== undefined) return cwd
    } catch {
      /* try the next location */
    }
  }
  return undefined
}

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
export async function terminalCwd(pid: number, fallback: string): Promise<string> {
  let cwd: string | undefined
  if (process.platform === 'linux') cwd = linuxProcessCwd(pid)
  if (cwd === undefined && pid > 0) cwd = await lsofProcessCwd(pid)
  return cwd === undefined ? fallback : cwd
}

/**
 * Resolve and validate a directory before it is handed to the file manager.
 *
 * @param path - candidate directory.
 * @returns its canonical absolute path.
 * @throws when the path is missing or is not a directory.
 */
export function requireDirectory(path: string): string {
  const canonical = realpathSync.native(path)
  if (!statSync(canonical).isDirectory()) throw new Error(`not a directory: ${path}`)
  return canonical
}

/**
 * The platform command that opens a directory in its desktop file manager.
 *
 * @param platform - Node platform identifier.
 * @param path - directory to open.
 * @returns the command and its argument vector.
 */
export function folderOpener(platform: NodeJS.Platform, path: string): FolderOpener {
  if (platform === 'darwin') return { command: '/usr/bin/open', args: [path] }
  if (platform === 'win32') return { command: 'explorer.exe', args: [path] }
  return { command: 'xdg-open', args: [path] }
}

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
export async function openDirectory(path: string): Promise<void> {
  const opener = folderOpener(process.platform, path)
  await new Promise<void>((resolve, reject) => {
    const child = spawn(opener.command, [...opener.args], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    let settled = false
    child.once('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
    child.once('spawn', () => {
      if (settled) return
      settled = true
      child.unref()
      resolve()
    })
  })
}
