import type { Component } from 'vue'

export type StatusTone = 'success' | 'danger' | 'warning' | 'muted'

export interface TabItem<Id extends string> {
  id: Id
  label: string
  icon?: Component
}
