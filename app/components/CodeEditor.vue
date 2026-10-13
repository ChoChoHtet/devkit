<script setup lang="ts">
import { basicSetup } from 'codemirror'
import { Compartment, EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { EditorView, placeholder as placeholderExtension } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { json } from '@codemirror/lang-json'
import { syntaxHighlighting } from '@codemirror/language'
import { setDiagnostics } from '@codemirror/lint'
import type { Diagnostic } from '@codemirror/lint'
import { classHighlighter } from '@lezer/highlight'
import { diagnosticRange } from '~/utils/editor'
import type { EditorDiagnostic, EditorLanguage } from '~/utils/editor'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    language?: EditorLanguage
    readonly?: boolean
    diagnostics?: readonly EditorDiagnostic[]
    placeholder?: string
    wrap?: boolean
  }>(),
  { language: 'json', readonly: false, diagnostics: () => [], placeholder: '', wrap: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Colours reference the CSS theme tokens, so light/dark switching needs no reconfiguration.
const devkitTheme: Extension = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.8125rem' },
  '&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '-1px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)', overflow: 'auto' },
  '.cm-content': { caretColor: 'var(--foreground)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-gutters': { backgroundColor: 'var(--background)', color: 'var(--muted)', borderRight: '1px solid var(--border)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklch, var(--accent) 6%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'color-mix(in oklch, var(--accent) 10%, transparent)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklch, var(--accent) 25%, transparent)',
  },
  '.cm-placeholder': { color: 'var(--muted)' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' },
  '.cm-panels': { backgroundColor: 'var(--background)', color: 'var(--foreground)' },
})

const host = ref<HTMLDivElement | null>(null)
const languageSlot = new Compartment()
const readonlySlot = new Compartment()
const placeholderSlot = new Compartment()
const attributesSlot = new Compartment()
const wrapSlot = new Compartment()
let view: EditorView | null = null
// Skips the round trip when the parent echoes back the value we just emitted.
let lastEmitted: string | null = null

function languageExtension(language: EditorLanguage): Extension {
  return language === 'json' ? json() : []
}

function wrapExtension(wrap: boolean): Extension {
  return wrap ? EditorView.lineWrapping : []
}

function contentAttributes(): Extension {
  return EditorView.contentAttributes.of({ 'aria-label': props.label, 'aria-readonly': String(props.readonly) })
}

function toCodeMirrorDiagnostics(state: EditorState, diagnostics: readonly EditorDiagnostic[]): Diagnostic[] {
  return diagnostics.map((d: EditorDiagnostic): Diagnostic => {
    const { from, to } = diagnosticRange(state.doc, d.line, d.column)
    return { from, to, severity: 'error', message: d.message }
  })
}

function applyDiagnostics(): void {
  if (!view) return
  view.dispatch(setDiagnostics(view.state, toCodeMirrorDiagnostics(view.state, props.diagnostics)))
}

onMounted((): void => {
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        syntaxHighlighting(classHighlighter),
        devkitTheme,
        languageSlot.of(languageExtension(props.language)),
        readonlySlot.of(EditorState.readOnly.of(props.readonly)),
        placeholderSlot.of(placeholderExtension(props.placeholder)),
        attributesSlot.of(contentAttributes()),
        wrapSlot.of(wrapExtension(props.wrap)),
        EditorView.updateListener.of((update: ViewUpdate): void => {
          if (!update.docChanged) return
          const value = update.state.doc.toString()
          if (value === props.modelValue) return
          lastEmitted = value
          emit('update:modelValue', value)
        }),
      ],
    }),
  })
  applyDiagnostics()
})

onBeforeUnmount((): void => {
  view?.destroy()
  view = null
})

watch(
  () => props.modelValue,
  (value: string): void => {
    if (!view) return
    if (value === lastEmitted) {
      lastEmitted = null
      return
    }
    lastEmitted = null
    if (value === view.state.doc.toString()) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    applyDiagnostics()
  },
)

watch(() => props.diagnostics, applyDiagnostics)
watch(
  () => props.language,
  (language: EditorLanguage): void => view?.dispatch({ effects: languageSlot.reconfigure(languageExtension(language)) }),
)
watch(
  () => [props.readonly, props.label] as const,
  (): void =>
    view?.dispatch({
      effects: [readonlySlot.reconfigure(EditorState.readOnly.of(props.readonly)), attributesSlot.reconfigure(contentAttributes())],
    }),
)
watch(
  () => props.wrap,
  (wrap: boolean): void => view?.dispatch({ effects: wrapSlot.reconfigure(wrapExtension(wrap)) }),
)
watch(
  () => props.placeholder,
  (text: string): void => view?.dispatch({ effects: placeholderSlot.reconfigure(placeholderExtension(text)) }),
)

defineExpose({
  focus: (): void => view?.focus(),
  getView: (): EditorView | null => view,
})
</script>

<template>
  <div ref="host" class="h-full min-h-0 overflow-hidden rounded-md border border-border" data-testid="code-editor" />
</template>
