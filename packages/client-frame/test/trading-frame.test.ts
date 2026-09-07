/**
 * The mount contract of the session-scoped `details` seat.
 *
 * dsh 0.1.2-rc.1's slot core enforces strict session scoping at render time:
 * rendering `details` outside the framework-injected `SessionProvider` throws
 * `SlotAssemblyError: strict session slot 'details' rendered without a scope
 * binding` on the first paint, and with no session open on boot that is every
 * boot — the whole shell unmounts to a blank page. The stock AppFrame survives
 * because the outlet rides INSIDE the provider, whose no-binding branch never
 * renders its children.
 *
 * These cases pin that shape without needing the framework: the provider stub
 * reproduces the runtime's real semantics (no binding → children dropped;
 * binding → children rendered), and the seats are identified by their markers
 * in the rendered markup. What the frame must never do is seat a session
 * outlet outside the provider.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TradingFrame } from '../src/client/TradingFrame.js'

// The frame reads window.innerWidth in its viewport state initializer;
// vitest runs in node and there is no DOM here.
;(globalThis as { window?: unknown }).window = { innerWidth: 1600 }

/** Provider invocations, captured per render for the mount-shape assertions. */
type ProviderCall = { passedChildren: boolean }

/**
 * Props mirroring the framework's seat shares, with the provider stubbed to
 * the runtime's real branch semantics.
 * @param boundSessionId - the session the framework's provider is bound to;
 *   undefined is the no-session boot (the hero screen).
 */
function makeProps(boundSessionId: string | undefined): {
  props: Record<string, unknown>
  providerCalls: ProviderCall[]
} {
  const state = { sidebar: 280, chart: 0.7, details: 300, narrow: false, narrowExpanded: false }
  const sessions = {
    current: boundSessionId,
    byId: boundSessionId === undefined ? {} : { [boundSessionId]: { blank: false } },
  }
  const providerCalls: ProviderCall[] = []

  const renderSlot = (key: string) => createElement('i', { 'data-seat': key }, `S:${key}`)
  const SessionProvider = (p: { empty?: () => unknown; children?: unknown }) => {
    providerCalls.push({ passedChildren: p.children !== undefined })
    // renderSessionArea (dsh-client-ui-session, 0.1.2-rc.1): no binding →
    // the empty branch only; binding → the children, keyed by the session.
    if (boundSessionId === undefined) return p.empty === undefined ? null : p.empty()
    return p.children
  }

  return {
    props: {
      useStore: (sel: (s: unknown) => unknown) => sel(state),
      useSessions: (sel: (s: unknown) => unknown) => sel(sessions),
      actions: {
        setNarrow: () => {},
        closeDetails: () => {},
        setSidebar: () => {},
        setChart: () => {},
        setDetails: () => {},
      },
      renderSlot,
      SessionProvider,
    },
    providerCalls,
  }
}

describe('TradingFrame details outlet', () => {
  it('boots with no session: details renders inside the SessionProvider, never outside it', () => {
    const { props, providerCalls } = makeProps(undefined)
    const markup = renderToStaticMarkup(createElement(TradingFrame as never, props as never))

    // The provider must be the seat's only path to the tree — a frame that
    // renders details beside it (not inside) leaks the seat even though the
    // provider's own branch drops children.
    expect(markup).not.toContain('S:details')
    expect(providerCalls).toHaveLength(1)
    expect(providerCalls[0]?.passedChildren).toBe(true)
    // The rest of the shell is unaffected by the gate.
    expect(markup).toContain('S:conversation')
    expect(markup).toContain('S:sidebar')
  })

  it('renders the details seat through the provider when a session is open', () => {
    const { props, providerCalls } = makeProps('s1')
    const markup = renderToStaticMarkup(createElement(TradingFrame as never, props as never))

    expect(markup).toContain('S:details')
    expect(providerCalls).toHaveLength(1)
    expect(providerCalls[0]?.passedChildren).toBe(true)
  })
})
