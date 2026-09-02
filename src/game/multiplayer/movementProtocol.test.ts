import { describe, it, expect } from 'vitest'
import {
  validateMovementPacket,
  estimatePacketBytes,
  RemotePlayerBuffer,
  shortestAngleDelta,
  MAX_PACKET_PAYLOAD_BYTES,
  type MovementPacketV1,
  type PacketValidationContext,
} from './movementProtocol'

function makePacket(overrides: Partial<MovementPacketV1> = {}): MovementPacketV1 {
  return {
    v: 1,
    roomId: 'room-1',
    userId: 'user-1',
    seq: 1,
    t: 1000,
    p: [0, 0, 0],
    yaw: 0,
    speed: 3.5,
    anim: 1,
    ...overrides,
  }
}

function makeCtx(overrides: Partial<PacketValidationContext> = {}): PacketValidationContext {
  return {
    roomId: 'room-1',
    memberIds: new Set(['user-1', 'user-2']),
    lastSeq: new Map<string, number>(),
    ...overrides,
  }
}

describe('validateMovementPacket (PRD §7.14)', () => {
  it('accepts a valid packet', () => {
    const result = validateMovementPacket(makePacket(), makeCtx())
    expect(result.ok).toBe(true)
  })

  it('rejects unknown protocol versions', () => {
    const result = validateMovementPacket(makePacket({ v: 2 as MovementPacketV1['v'] }), makeCtx())
    expect(result).toEqual({ ok: false, reason: 'WRONG_PROTOCOL' })
  })

  it('rejects packets from another room', () => {
    const result = validateMovementPacket(makePacket({ roomId: 'room-2' }), makeCtx())
    expect(result).toEqual({ ok: false, reason: 'WRONG_ROOM' })
  })

  it('rejects packets from non-members', () => {
    const result = validateMovementPacket(makePacket({ userId: 'intruder' }), makeCtx())
    expect(result).toEqual({ ok: false, reason: 'NOT_MEMBER' })
  })

  it('rejects stale sequences and enforces monotonic increase', () => {
    const ctx = makeCtx({ lastSeq: new Map([['user-1', 5]]) })
    expect(validateMovementPacket(makePacket({ seq: 5 }), ctx)).toEqual({
      ok: false,
      reason: 'STALE_SEQUENCE',
    })
    expect(validateMovementPacket(makePacket({ seq: 4 }), ctx)).toEqual({
      ok: false,
      reason: 'STALE_SEQUENCE',
    })
    expect(validateMovementPacket(makePacket({ seq: 6 }), ctx).ok).toBe(true)
  })

  it('rejects non-finite values', () => {
    expect(validateMovementPacket(makePacket({ yaw: Number.NaN }), makeCtx())).toEqual({
      ok: false,
      reason: 'NON_FINITE',
    })
    expect(
      validateMovementPacket(makePacket({ p: [0, Number.POSITIVE_INFINITY, 0] }), makeCtx())
    ).toEqual({ ok: false, reason: 'NON_FINITE' })
    expect(validateMovementPacket(makePacket({ t: Number.NaN }), makeCtx())).toEqual({
      ok: false,
      reason: 'NON_FINITE',
    })
    expect(validateMovementPacket(makePacket({ anim: 9 as MovementPacketV1['anim'] }), makeCtx())).toEqual({
      ok: false,
      reason: 'NON_FINITE',
    })
  })

  it('rejects positions outside the 64x64 island bounds', () => {
    expect(validateMovementPacket(makePacket({ p: [40, 0, 0] }), makeCtx())).toEqual({
      ok: false,
      reason: 'OUT_OF_BOUNDS',
    })
    expect(validateMovementPacket(makePacket({ p: [0, 0, -33] }), makeCtx())).toEqual({
      ok: false,
      reason: 'OUT_OF_BOUNDS',
    })
    expect(validateMovementPacket(makePacket({ p: [0, -12, 0] }), makeCtx())).toEqual({
      ok: false,
      reason: 'OUT_OF_BOUNDS',
    })
  })

  it('rejects implausible speeds', () => {
    expect(validateMovementPacket(makePacket({ speed: -1 }), makeCtx())).toEqual({
      ok: false,
      reason: 'IMPLAUSIBLE_SPEED',
    })
    expect(validateMovementPacket(makePacket({ speed: 999 }), makeCtx())).toEqual({
      ok: false,
      reason: 'IMPLAUSIBLE_SPEED',
    })
  })
})

describe('estimatePacketBytes (PRD §11.3: < 256 bytes)', () => {
  it('keeps the payload well below the limit for realistic ids', () => {
    const packet = makePacket({
      roomId: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      seq: 123456,
      t: 1725193200000,
    })
    expect(estimatePacketBytes(packet)).toBeLessThan(MAX_PACKET_PAYLOAD_BYTES)
  })
})

describe('shortestAngleDelta', () => {
  it('wraps across the -pi/pi boundary', () => {
    expect(shortestAngleDelta(Math.PI * 0.75, -Math.PI * 0.75)).toBeCloseTo(Math.PI * 0.5)
    expect(shortestAngleDelta(-Math.PI * 0.75, Math.PI * 0.75)).toBeCloseTo(-Math.PI * 0.5)
  })

  it('returns zero for identical angles', () => {
    expect(shortestAngleDelta(1.23, 1.23)).toBe(0)
  })
})

describe('RemotePlayerBuffer (PRD §7.14)', () => {
  it('returns null when empty and reports depth', () => {
    const buffer = new RemotePlayerBuffer()
    expect(buffer.sample(0)).toBeNull()
    expect(buffer.depth).toBe(0)
  })

  it('interpolates linearly between two snapshots', () => {
    const buffer = new RemotePlayerBuffer()
    buffer.push({ t: 1000, p: [0, 0, 0], yaw: 0, speed: 3, anim: 1 })
    buffer.push({ t: 1100, p: [10, 0, 0], yaw: 1, speed: 3, anim: 1 })

    const mid = buffer.sample(1050)
    expect(mid).not.toBeNull()
    expect(mid!.p[0]).toBeCloseTo(5)
    expect(mid!.yaw).toBeCloseTo(0.5)
  })

  it('clamps to the oldest snapshot when render time precedes the buffer', () => {
    const buffer = new RemotePlayerBuffer()
    buffer.push({ t: 1000, p: [5, 0, 0], yaw: 0, speed: 3, anim: 1 })
    buffer.push({ t: 1100, p: [10, 0, 0], yaw: 0, speed: 3, anim: 1 })

    const state = buffer.sample(900)
    expect(state!.p[0]).toBeCloseTo(5)
  })

  it('extrapolates up to 250 ms then eases to idle', () => {
    const buffer = new RemotePlayerBuffer()
    buffer.push({ t: 1000, p: [0, 0, 0], yaw: 0, speed: 3, anim: 1 })
    buffer.push({ t: 1100, p: [4, 0, 0], yaw: 0, speed: 3, anim: 2 })

    const within = buffer.sample(1100 + 200)
    expect(within).not.toBeNull()
    expect(within!.p[0]).toBeCloseTo(4)

    const beyond = buffer.sample(1100 + 400)
    expect(beyond).not.toBeNull()
    expect(beyond!.anim).toBe(0)
    expect(beyond!.speed).toBe(0)
  })

  it('keeps a single snapshot as-is while fresh and idles when stale', () => {
    const buffer = new RemotePlayerBuffer()
    buffer.push({ t: 1000, p: [2, 0, 2], yaw: 0.5, speed: 3, anim: 1 })

    const fresh = buffer.sample(1000)
    expect(fresh!.p).toEqual([2, 0, 2])

    const stale = buffer.sample(1000 + 300)
    expect(stale!.anim).toBe(0)
  })

  it('caps the buffer size and drops the oldest snapshot', () => {
    const buffer = new RemotePlayerBuffer(3)
    for (let i = 0; i < 5; i++) {
      buffer.push({ t: 1000 + i * 50, p: [i, 0, 0], yaw: 0, speed: 3, anim: 1 })
    }
    expect(buffer.depth).toBe(3)
    const state = buffer.sample(1000)
    expect(state!.p[0]).toBeCloseTo(2)
  })

  it('interpolates yaw across the angle wrap boundary', () => {
    const buffer = new RemotePlayerBuffer()
    buffer.push({ t: 1000, p: [0, 0, 0], yaw: Math.PI * 0.9, speed: 3, anim: 1 })
    buffer.push({ t: 1100, p: [0, 0, 1], yaw: -Math.PI * 0.9, speed: 3, anim: 1 })

    const mid = buffer.sample(1050)
    expect(mid!.yaw).toBeCloseTo(Math.PI)
  })
})
