import { fail, ok } from '../result'
import type { Result } from '../result'

export type TimestampUnit = 'auto' | 's' | 'ms'

export interface DetectedTimestamp {
  epochMs: number
  unit: 's' | 'ms'
}

export interface TimestampDecoded {
  epochMs: number
  epochSeconds: number
  unit: 's' | 'ms'
  utcIso: string
  relative: string
}

export interface EncodedTimestamp {
  epochMs: number
  epochSeconds: number
}

export interface PresetOffset {
  id: string
  label: string
  offsetSeconds: number
}

// Current epoch seconds are ~1.76e9 (10 digits); epoch ms are ~1.76e12 (13 digits). 1e11 sits
// comfortably between the two, with wide margin on both sides, so a single threshold suffices.
const MS_THRESHOLD = 1e11

function resolveUnit(numeric: number, unit: TimestampUnit): 's' | 'ms' {
  if (unit !== 'auto') return unit
  return Math.abs(numeric) >= MS_THRESHOLD ? 'ms' : 's'
}

export function parseTimestamp(raw: string, unit: TimestampUnit): Result<DetectedTimestamp> {
  const trimmed = raw.trim()
  if (trimmed === '') return fail('Input is empty')
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric)) return fail('Not a valid number')
  const resolved = resolveUnit(numeric, unit)
  const epochMs = resolved === 's' ? numeric * 1000 : numeric
  if (!Number.isFinite(epochMs) || Number.isNaN(new Date(epochMs).getTime())) return fail('Timestamp is out of range')
  return ok({ epochMs, unit: resolved })
}

interface RelativeBucket {
  limit: number
  divisor: number
  singular: string
  plural: string
}

const RELATIVE_BUCKETS: readonly RelativeBucket[] = [
  { limit: 60, divisor: 1, singular: 'second', plural: 'seconds' },
  { limit: 3600, divisor: 60, singular: 'minute', plural: 'minutes' },
  { limit: 86400, divisor: 3600, singular: 'hour', plural: 'hours' },
  { limit: 2592000, divisor: 86400, singular: 'day', plural: 'days' },
  { limit: 31536000, divisor: 2592000, singular: 'month', plural: 'months' },
  { limit: Infinity, divisor: 31536000, singular: 'year', plural: 'years' },
]

export function describeRelative(epochMs: number, now: number): string {
  const deltaSeconds = Math.round((epochMs - now) / 1000)
  const absSeconds = Math.abs(deltaSeconds)
  if (absSeconds < 5) return 'just now'
  // The last bucket's limit is Infinity, so find() always matches.
  const bucket = RELATIVE_BUCKETS.find((b) => absSeconds < b.limit)!
  const amount = Math.max(1, Math.round(absSeconds / bucket.divisor))
  const label = amount === 1 ? bucket.singular : bucket.plural
  return deltaSeconds >= 0 ? `in ${amount} ${label}` : `${amount} ${label} ago`
}

export function decodeTimestamp(raw: string, unit: TimestampUnit, now: number = Date.now()): Result<TimestampDecoded> {
  const parsed = parseTimestamp(raw, unit)
  if (!parsed.ok) return parsed
  const { epochMs, unit: resolvedUnit } = parsed.value
  return ok({
    epochMs,
    epochSeconds: Math.round(epochMs / 1000),
    unit: resolvedUnit,
    utcIso: new Date(epochMs).toISOString(),
    relative: describeRelative(epochMs, now),
  })
}

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * Every IANA zone name the JS engine knows, e.g. "America/New_York". "UTC" is prepended
 * explicitly — `Intl.supportedValuesOf('timeZone')` accepts it as a timeZone value everywhere,
 * but doesn't actually include it in its own enumerated list.
 */
export function listTimeZones(): readonly string[] {
  if (typeof Intl.supportedValuesOf !== 'function') return ['UTC']
  try {
    return ['UTC', ...Intl.supportedValuesOf('timeZone')]
  } catch {
    return ['UTC']
  }
}

/** The host's own IANA zone name (e.g. "Asia/Bangkok") — depends on the machine, not deterministic. */
export function resolveLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function zonedPartsToUtcMs(formatter: Intl.DateTimeFormat, instantMs: number): number {
  const parts = formatter.formatToParts(new Date(instantMs))
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
}

/**
 * Converts a `datetime-local` value, read as wall-clock time in `timeZone`, to an epoch.
 * Deterministic and testable for any named IANA zone (the JS engine's bundled tzdata, not the
 * host's configured zone) — only resolving what "local" concretely means on a given machine
 * (resolveLocalTimeZone) is non-deterministic, not this conversion itself.
 *
 * Works by reading the guessed UTC instant back through the target zone and measuring the gap
 * to the wanted wall-clock time; accurate except exactly at a DST transition instant.
 */
export function encodeZonedDateTime(dateTimeLocal: string, timeZone: string): Result<EncodedTimestamp> {
  const match = DATETIME_LOCAL_PATTERN.exec(dateTimeLocal.trim())
  if (!match) return fail('Not a valid date/time')
  const [, year, month, day, hour, minute, second] = match
  const guessMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), second ? Number(second) : 0)
  if (!Number.isFinite(guessMs)) return fail('Date/time is out of range')

  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
  } catch {
    return fail(`Unknown time zone: ${timeZone}`)
  }

  const offset = guessMs - zonedPartsToUtcMs(formatter, guessMs)
  const epochMs = guessMs + offset
  return ok({ epochMs, epochSeconds: Math.round(epochMs / 1000) })
}

/** A short "GMT+7"/"GMT-04:00"-style offset label for `timeZone` at `epochMs`. */
export function describeZoneOffset(epochMs: number, timeZone: string): Result<string> {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date(epochMs))
    const label = parts.find((p) => p.type === 'timeZoneName')?.value
    return label ? ok(label) : fail(`Unknown time zone: ${timeZone}`)
  } catch {
    return fail(`Unknown time zone: ${timeZone}`)
  }
}

export const TIMESTAMP_PRESETS: readonly PresetOffset[] = [
  { id: 'now', label: 'Now', offsetSeconds: 0 },
  { id: 'plus-15m', label: '+15 min', offsetSeconds: 15 * 60 },
  { id: 'plus-1h', label: '+1 hour', offsetSeconds: 60 * 60 },
  { id: 'plus-1d', label: '+1 day', offsetSeconds: 24 * 60 * 60 },
  { id: 'plus-7d', label: '+7 days', offsetSeconds: 7 * 24 * 60 * 60 },
  { id: 'plus-30d', label: '+30 days', offsetSeconds: 30 * 24 * 60 * 60 },
]

export function applyPreset(preset: PresetOffset, now: number = Date.now()): number {
  return Math.round(now / 1000) + preset.offsetSeconds
}

export function isTimestampUnit(value: unknown): value is TimestampUnit {
  return value === 'auto' || value === 's' || value === 'ms'
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}
