import assert from 'node:assert/strict'
import test from 'node:test'
import {
  loadSidebarCollapsed,
  saveSidebarCollapsed,
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
