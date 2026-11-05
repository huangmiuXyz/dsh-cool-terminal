import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SESSION_KEY,
  groupKeyForSession,
  lastOrNewTerminal,
  loadSidebarCollapsed,
  saveSidebarCollapsed,
  terminalsFor,
  type TerminalAccount,
} from '../src/client/terminals.ts'

const values = new Map<string, string>()

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string): string | null {
        return values.get(key) ?? null
      },
      setItem(key: string, value: string): void {
        values.set(key, value)
      },
      removeItem(key: string): void {
        values.delete(key)
      },
    },
  },
})

test('the terminal sidebar starts expanded', () => {
  values.clear()
  assert.equal(loadSidebarCollapsed(), false)
})

test('the terminal sidebar collapse state is persisted', () => {
  values.clear()
  saveSidebarCollapsed(true)
  assert.equal(loadSidebarCollapsed(), true)
  saveSidebarCollapsed(false)
  assert.equal(loadSidebarCollapsed(), false)
})

test('a malformed sidebar preference falls back to expanded', () => {
  values.clear()
  values.set('dsh-cool-terminal.sidebar.collapsed.v1', '"not-a-boolean"')
  assert.equal(loadSidebarCollapsed(), false)
})

test('one-key activation picks the last console in a populated group', () => {
  const first = { id: 'w1:t1', title: 'Terminal 1' }
  const last = { id: 'w1:t2', title: 'Terminal 2' }
  const account: TerminalAccount = { w1: [first, last] }

  const choice = lastOrNewTerminal(account, 'w1')

  assert.equal(choice.account, account)
  assert.equal(choice.terminal, last)
})

test('one-key activation mints a console when the group is empty', () => {
  const choice = lastOrNewTerminal({}, 'w1', (number) => `Terminal ${number}`)

  assert.equal(choice.terminal.title, 'Terminal 1')
  assert.deepEqual(terminalsFor(choice.account, 'w1'), [choice.terminal])
})

test('the current group follows Workspace membership before the workdir', () => {
  const items = [
    { workspaceId: 'w1', path: '/work/one', sessionIds: ['s1'] },
    { workspaceId: 'w2', path: '/work/two', sessionIds: ['s2'] },
  ]

  assert.equal(groupKeyForSession(items, 's1', '/somewhere/else'), 'w1')
})

test('a session outside every Workspace falls back to its workdir', () => {
  const items = [
    { workspaceId: 'w1', path: '/work/one', sessionIds: ['s1'] },
    { workspaceId: 'w2', path: '/work/two', sessionIds: [] },
  ]

  assert.equal(groupKeyForSession(items, 's9', '/work/two/'), 'w2')
  assert.equal(groupKeyForSession(items, 's9', '/work/other'), SESSION_KEY)
  assert.equal(groupKeyForSession(items, 's9', ''), undefined)
})
