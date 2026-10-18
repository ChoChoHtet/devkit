import { describe, expect, it } from 'vitest'
import {
  applyPreset,
  decodeTimestamp,
  describeRelative,
  describeZoneOffset,
  encodeZonedDateTime,
  isNonEmptyString,
  isTimestampUnit,
  listTimeZones,
  parseTimestamp,
  resolveLocalTimeZone,
  TIMESTAMP_PRESETS,
} from '../../../app/utils/timestamp/convert'

describe('parseTimestamp', () => {
  it('auto-detects a 10-digit value as seconds', () => {
    expect(parseTimestamp('1700000000', 'auto')).toEqual({ ok: true, value: { epochMs: 1700000000_000, unit: 's' } })
  })

  it('auto-detects a 13-digit value as milliseconds', () => {
    expect(parseTimestamp('1700000000000', 'auto')).toEqual({ ok: true, value: { epochMs: 1700000000000, unit: 'ms' } })
  })

  it('respects an explicit unit override against the digit-count heuristic', () => {
    expect(parseTimestamp('1700000000000', 's')).toEqual({ ok: true, value: { epochMs: 1700000000000_000, unit: 's' } })
    expect(parseTimestamp('1700000000', 'ms')).toEqual({ ok: true, value: { epochMs: 1700000000, unit: 'ms' } })
  })

  it('fails on empty input', () => {
    expect(parseTimestamp('', 'auto').ok).toBe(false)
    expect(parseTimestamp('   ', 'auto').ok).toBe(false)
  })

  it('fails on non-numeric input', () => {
    expect(parseTimestamp('not-a-number', 'auto').ok).toBe(false)
  })

  it('fails on NaN/Infinity-producing input', () => {
    expect(parseTimestamp('Infinity', 'auto').ok).toBe(false)
    expect(parseTimestamp('NaN', 'auto').ok).toBe(false)
  })
})

describe('describeRelative', () => {
  const now = 1_700_000_000_000

  it('reads "just now" for a tiny delta', () => {
    expect(describeRelative(now + 2000, now)).toBe('just now')
    expect(describeRelative(now - 2000, now)).toBe('just now')
  })

  it('describes a future delta as "in ..."', () => {
    expect(describeRelative(now + 7200_000, now)).toBe('in 2 hours')
    expect(describeRelative(now + 3600_000, now)).toBe('in 1 hour')
  })

  it('describes a past delta as "... ago"', () => {
    expect(describeRelative(now - 7200_000, now)).toBe('2 hours ago')
    expect(describeRelative(now - 86400_000, now)).toBe('1 day ago')
  })
})

describe('decodeTimestamp', () => {
  const now = 1_700_000_000_000

  it('returns the expected UTC ISO string for a known epoch', () => {
    const result = decodeTimestamp('1700000000', 'auto', now)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.utcIso).toBe('2023-11-14T22:13:20.000Z')
  })

  it('includes a relative description', () => {
    const result = decodeTimestamp(String(now / 1000 + 3600), 's', now)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.relative).toBe('in 1 hour')
  })

  it('propagates a parse failure', () => {
    expect(decodeTimestamp('nope', 'auto', now).ok).toBe(false)
  })
})

describe('encodeZonedDateTime', () => {
  it('converts a known datetime-local string to the expected epoch, in UTC', () => {
    const result = encodeZonedDateTime('2026-01-01T00:00', 'UTC')
    expect(result).toEqual({ ok: true, value: { epochMs: Date.UTC(2026, 0, 1, 0, 0), epochSeconds: Date.UTC(2026, 0, 1, 0, 0) / 1000 } })
  })

  it('accepts an optional seconds component', () => {
    const result = encodeZonedDateTime('2026-01-01T00:00:30', 'UTC')
    expect(result).toEqual({ ok: true, value: { epochMs: Date.UTC(2026, 0, 1, 0, 0, 30), epochSeconds: Date.UTC(2026, 0, 1, 0, 0, 30) / 1000 } })
  })

  it('converts against a named zone with no DST (Asia/Tokyo, UTC+9)', () => {
    const result = encodeZonedDateTime('2026-01-01T00:00', 'Asia/Tokyo')
    expect(result).toEqual({
      ok: true,
      value: { epochMs: Date.UTC(2025, 11, 31, 15, 0), epochSeconds: Date.UTC(2025, 11, 31, 15, 0) / 1000 },
    })
  })

  it('accounts for DST in a zone that observes it (America/New_York)', () => {
    const winter = encodeZonedDateTime('2026-01-01T00:00', 'America/New_York') // EST, UTC-5
    const summer = encodeZonedDateTime('2026-07-01T00:00', 'America/New_York') // EDT, UTC-4
    expect(winter).toEqual({ ok: true, value: { epochMs: Date.UTC(2026, 0, 1, 5, 0), epochSeconds: Date.UTC(2026, 0, 1, 5, 0) / 1000 } })
    expect(summer).toEqual({ ok: true, value: { epochMs: Date.UTC(2026, 6, 1, 4, 0), epochSeconds: Date.UTC(2026, 6, 1, 4, 0) / 1000 } })
  })

  it('fails on a malformed string', () => {
    expect(encodeZonedDateTime('not-a-date', 'UTC').ok).toBe(false)
    expect(encodeZonedDateTime('2026-01-01', 'UTC').ok).toBe(false)
  })

  it('fails on an unknown time zone', () => {
    expect(encodeZonedDateTime('2026-01-01T00:00', 'Not/AZone').ok).toBe(false)
  })
})

describe('describeZoneOffset', () => {
  const epochMs = Date.UTC(2026, 0, 1, 0, 0)

  it('describes UTC', () => {
    expect(describeZoneOffset(epochMs, 'UTC')).toEqual({ ok: true, value: 'GMT+0' })
  })

  it('describes a positive offset', () => {
    expect(describeZoneOffset(epochMs, 'Asia/Tokyo')).toEqual({ ok: true, value: 'GMT+9' })
  })

  it('describes a negative, DST-aware offset', () => {
    expect(describeZoneOffset(Date.UTC(2026, 0, 1), 'America/New_York')).toEqual({ ok: true, value: 'GMT-5' })
    expect(describeZoneOffset(Date.UTC(2026, 6, 1), 'America/New_York')).toEqual({ ok: true, value: 'GMT-4' })
  })

  it('fails on an unknown time zone', () => {
    expect(describeZoneOffset(epochMs, 'Not/AZone').ok).toBe(false)
  })
})

describe('listTimeZones', () => {
  it('always includes UTC', () => {
    expect(listTimeZones()).toContain('UTC')
  })

  it('includes real IANA zones', () => {
    expect(listTimeZones()).toContain('Asia/Tokyo')
  })
})

describe('resolveLocalTimeZone', () => {
  it('returns a non-empty zone name', () => {
    expect(resolveLocalTimeZone().length).toBeGreaterThan(0)
  })
})

describe('applyPreset', () => {
  const now = 1_700_000_000_000

  it('"now" returns now unchanged, in seconds', () => {
    const preset = TIMESTAMP_PRESETS.find((p) => p.id === 'now')!
    expect(applyPreset(preset, now)).toBe(now / 1000)
  })

  it('"+1 hour" adds 3600 seconds', () => {
    const preset = TIMESTAMP_PRESETS.find((p) => p.id === 'plus-1h')!
    expect(applyPreset(preset, now)).toBe(now / 1000 + 3600)
  })

  it('"+30 days" adds the expected number of seconds', () => {
    const preset = TIMESTAMP_PRESETS.find((p) => p.id === 'plus-30d')!
    expect(applyPreset(preset, now)).toBe(now / 1000 + 30 * 24 * 60 * 60)
  })
})

describe('isTimestampUnit', () => {
  it('accepts valid units', () => {
    expect(isTimestampUnit('auto')).toBe(true)
    expect(isTimestampUnit('s')).toBe(true)
    expect(isTimestampUnit('ms')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isTimestampUnit('seconds')).toBe(false)
    expect(isTimestampUnit(123)).toBe(false)
    expect(isTimestampUnit(undefined)).toBe(false)
  })
})

describe('isNonEmptyString', () => {
  it('accepts a non-empty string', () => {
    expect(isNonEmptyString('UTC')).toBe(true)
  })

  it('rejects an empty string or anything else', () => {
    expect(isNonEmptyString('')).toBe(false)
    expect(isNonEmptyString(123)).toBe(false)
    expect(isNonEmptyString(null)).toBe(false)
  })
})
