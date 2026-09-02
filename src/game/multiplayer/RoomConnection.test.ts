import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RoomConnection, LEASE_RENEWAL_INTERVAL_MS } from './RoomConnection'
import { useNetStore } from './netStore'
import { validateMovementPacket, type PacketValidationContext } from './movementProtocol'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeCtx(overrides: Partial<PacketValidationContext> = {}): PacketValidationContext {
  return {
    roomId: 'room-1',
    memberIds: new Set(['user-1']),
    lastSeq: new Map<string, number>(),
    ...overrides,
  }
}

describe('validateMovementPacket payload shape', () => {
  it('rejects non-object payloads with MALFORMED_PAYLOAD', () => {
    expect(validateMovementPacket('nope', makeCtx())).toEqual({
      ok: false,
      reason: 'MALFORMED_PAYLOAD',
    })
    expect(validateMovementPacket(42, makeCtx())).toEqual({
      ok: false,
      reason: 'MALFORMED_PAYLOAD',
    })
    expect(validateMovementPacket(null, makeCtx())).toEqual({
      ok: false,
      reason: 'MALFORMED_PAYLOAD',
    })
  })
})

describe('RoomConnection rejoin after leave', () => {
  const fakeChannel = () => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    track: vi.fn(),
    send: vi.fn().mockResolvedValue('ok'),
    state: 'joined' as const,
  })

  function makeSupabase() {
    const channel = fakeChannel()
    return {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      rpc: vi.fn().mockImplementation((name: string) => {
        if (name === 'join_or_create_room') {
          return Promise.resolve({
            data: { ok: true, roomId: 'room-1', slot: 0, reconnected: false },
            error: null,
          })
        }
        if (name === 'get_room_snapshot') {
          return Promise.resolve({
            data: {
              members: [{ userId: 'user-1', username: 'Test', slot: 0 }],
              plots: [],
            },
            error: null,
          })
        }
        return Promise.resolve({ data: { ok: true }, error: null })
      }),
    }
  }

  beforeEach(() => {
    useNetStore.getState().reset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('can rejoin with the same singleton after leave', async () => {
    const supabase = makeSupabase() as unknown as SupabaseClient
    const connection = new RoomConnection({
      supabase,
      getUserId: () => 'user-1',
    })

    await connection.join()
    expect(useNetStore.getState().roomId).toBe('room-1')
    expect(useNetStore.getState().ownUserId).toBe('user-1')

    await connection.leave()
    expect(useNetStore.getState().roomId).toBeNull()

    // Rejoin: the disposed flag must reset, not block the second session.
    await connection.join()
    expect(useNetStore.getState().roomId).toBe('room-1')
    expect(useNetStore.getState().ownUserId).toBe('user-1')
  })

  it('renews the lease on the 10-second interval', async () => {
    const supabase = makeSupabase() as unknown as SupabaseClient
    const connection = new RoomConnection({ supabase, getUserId: () => 'user-1' })
    await connection.join()
    expect(LEASE_RENEWAL_INTERVAL_MS).toBe(10_000)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(supabase.rpc).toHaveBeenCalledWith('renew_room_lease', { p_room_id: 'room-1' })

    await connection.leave()
  })
})
