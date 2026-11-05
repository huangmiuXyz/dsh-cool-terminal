/**
 * Cross-surface focus requests for the terminal workbench.
 *
 * A keyboard command runs outside React and cannot reach whichever surface is
 * mounted. This tiny observable carries one request — which surface should move
 * keyboard focus into its active console — so the sidebar body, which may
 * mount only after the request, still sees it. A request is a one-shot gesture,
 * not browser state, so it is kept out of the persisted UI model.
 */

/** The surface a focus request is addressed to. */
export type TerminalFocusTarget = 'conversation' | 'sidebar'

/** One request; `seq` makes an identical target a fresh request. */
export interface TerminalFocusRequest {
  readonly target: TerminalFocusTarget
  readonly seq: number
}

/** The observable a surface reads to learn that it should take focus. */
export interface TerminalFocusBus {
  getSnapshot(): TerminalFocusRequest | null
  subscribe(listener: () => void): () => void
  request(target: TerminalFocusTarget): void
}

/**
 * Build one plugin-lifetime focus bus.
 *
 * The snapshot is identity-stable until a request arrives, which is what
 * `useSyncExternalStore` requires; each request publishes a new object even
 * when the target repeats, so a second press still moves focus after the user
 * clicked elsewhere in between.
 *
 * @returns a bus safe to read before any surface has mounted.
 */
export function createTerminalFocusBus(): TerminalFocusBus {
  let request: TerminalFocusRequest | null = null
  let sequence = 0
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => request,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    request(target: TerminalFocusTarget): void {
      sequence += 1
      request = { target, seq: sequence }
      for (const listener of [...listeners]) listener()
    },
  }
}