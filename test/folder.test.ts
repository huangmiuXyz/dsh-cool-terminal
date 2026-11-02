import assert from 'node:assert/strict'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  folderOpener,
  parseLsofCwd,
  requireDirectory,
  terminalCwd,
} from '../src/host/folder.ts'

test('parseLsofCwd reads the cwd descriptor name', () => {
  assert.equal(
    parseLsofCwd('p10208\nfcwd\nn/Users/example/project\n'),
    '/Users/example/project',
  )
})

test('parseLsofCwd ignores unrelated fields and keeps the last name', () => {
  assert.equal(parseLsofCwd('p1\nf0\nn/dev/null\nfcwd\nn/work\n'), '/work')
  assert.equal(parseLsofCwd('p1\nfcwd\n'), undefined)
  assert.equal(parseLsofCwd(''), undefined)
})

test('terminalCwd falls back when the process cannot be inspected', async () => {
  assert.equal(await terminalCwd(-1, '/fallback'), '/fallback')
})

test('terminalCwd observes the current process directory', async () => {
  const cwd = await terminalCwd(process.pid, '/fallback')
  assert.equal(realpathSync(cwd), realpathSync(process.cwd()))
})

test('requireDirectory accepts a directory and rejects a file', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-cool-terminal-'))
  try {
    const file = join(root, 'file.txt')
    requireDirectory(root)
    writeFileSync(file, 'not a directory', 'utf8')
    assert.throws(() => requireDirectory(file), /not a directory/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('folderOpener uses the platform file manager without a shell', () => {
  assert.deepEqual(folderOpener('darwin', '/work'), {
    command: '/usr/bin/open',
    args: ['/work'],
  })
  assert.deepEqual(folderOpener('linux', '/work'), {
    command: 'xdg-open',
    args: ['/work'],
  })
  assert.deepEqual(folderOpener('win32', 'C:\\work'), {
    command: 'explorer.exe',
    args: ['C:\\work'],
  })
})
