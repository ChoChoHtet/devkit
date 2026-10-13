import type { Ref } from 'vue'

export const PREFERENCE_PREFIX = 'devkit:'

/**
 * A localStorage-backed preference. Reads after mount so prerendered HTML and the first
 * client render agree, and swallows storage errors (private mode, blocked site data).
 */
export function usePreference<T>(key: string, defaultValue: T, isValid: (value: unknown) => value is T): Ref<T> {
  const state = ref(defaultValue) as Ref<T>
  const storageKey = `${PREFERENCE_PREFIX}${key}`

  onMounted((): void => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw === null) return
      const parsed: unknown = JSON.parse(raw)
      if (isValid(parsed)) state.value = parsed
    } catch {
      // Unreadable or corrupt storage: keep the default.
    }
  })

  watch(state, (value: T): void => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      // Storage unavailable: the preference just won't persist.
    }
  })

  return state
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}
