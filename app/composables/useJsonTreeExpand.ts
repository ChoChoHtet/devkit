import type { InjectionKey } from 'vue'
import type { TreeExpandMode } from '~/utils/json/tree'

export interface TreeExpandState {
  mode: TreeExpandMode
  version: number
}

export const JSON_TREE_EXPAND: InjectionKey<Readonly<TreeExpandState>> = Symbol('jsonTreeExpand')

export function provideJsonTreeExpand(): { state: Readonly<TreeExpandState>; set: (mode: TreeExpandMode) => void } {
  const state = reactive<TreeExpandState>({ mode: 'default', version: 0 })
  provide(JSON_TREE_EXPAND, readonly(state))
  return {
    state,
    set: (mode: TreeExpandMode): void => {
      state.mode = mode
      state.version++
    },
  }
}

export function useJsonTreeExpand(): Readonly<TreeExpandState> {
  return inject(JSON_TREE_EXPAND, { mode: 'default', version: 0 })
}
