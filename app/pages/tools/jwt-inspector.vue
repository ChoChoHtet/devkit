<script setup lang="ts">
import { Eraser, FileSignature, FolderOpen, KeyRound, ListChecks, ScanEye, ShieldQuestion, Sparkles } from '@lucide/vue'
import { getTool } from '~/utils/tools'
import type { ToolDefinition } from '~/utils/tools'
import { decodeJwt } from '~/utils/jwt/decode'
import type { JwtDecoded } from '~/utils/jwt/decode'
import { buildJwtSample, JWT_SAMPLE_SECRET } from '~/utils/jwt/sample'
import { keyInputKindFor } from '~/utils/jwt/alg'
import { verifyJwtSignature } from '~/utils/jwt/verify'
import type { VerifyOutcome } from '~/utils/jwt/verify'
import { signJwt } from '~/utils/jwt/sign'
import type { SignedJwt } from '~/utils/jwt/sign'
import { copyText } from '~/utils/clipboard'
import { triggerDownload } from '~/utils/download'
import type { LoadedTextFile } from '~/utils/file'
import type { DownloadPayload, Result } from '~/utils/result'
import type { TabItem } from '~/utils/ui'

type JwtMode = 'decode' | 'encode'
type JwtTab = 'claims' | 'verify'

const JSON_MIME = 'application/json'
const NOTICE_MS = 2000

const MODE_TABS: readonly TabItem<JwtMode>[] = [
  { id: 'decode', label: 'Decode', icon: ScanEye },
  { id: 'encode', label: 'Encode', icon: FileSignature },
]

const TABS: readonly TabItem<JwtTab>[] = [
  { id: 'claims', label: 'Claims', icon: ListChecks },
  { id: 'verify', label: 'Verify', icon: ShieldQuestion },
]

const ENCODE_SAMPLE_HEADER = JSON.stringify({ alg: 'HS256', typ: 'JWT' }, null, 2)

// Computed fresh (not a fixed constant) so the example's exp is always still in the future.
function encodeSamplePayload(now: number = Date.now()): string {
  const nowSeconds = Math.floor(now / 1000)
  return JSON.stringify(
    { sub: 'user_01hzx', name: 'Ada Lovelace', role: 'admin', iat: nowSeconds, exp: nowSeconds + 3600 },
    null,
    2,
  )
}

const tool: ToolDefinition = getTool('jwt-inspector')
useToolSeo(tool)

const mode = ref<JwtMode>('decode')
const notice = ref<string>('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function notify(message: string): void {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout((): void => {
    notice.value = ''
  }, NOTICE_MS)
}

// ── Decode mode ──────────────────────────────────────────────────────────────

const inputDrop = ref<{ open: () => void } | null>(null)
const input = ref<string>('')
const activeTab = ref<JwtTab>('claims')

const decoded = computed<Result<JwtDecoded> | null>(() => (input.value.trim() === '' ? null : decodeJwt(input.value)))
const decodedJson = computed<string>(() =>
  decoded.value?.ok ? JSON.stringify({ header: decoded.value.value.header, payload: decoded.value.value.payload }, null, 2) : '',
)
function claimsPayload(): DownloadPayload {
  return { filename: 'jwt-claims.json', mimeType: JSON_MIME, data: decodedJson.value }
}

const keyMaterial = ref<string>('')
const verifyResult = shallowRef<Result<VerifyOutcome> | null>(null)
const verifying = ref<boolean>(false)
let lastVerifiedToken: string | null = null

const alg = computed<string | null>(() => {
  const value = decoded.value?.ok ? decoded.value.value.header.alg : null
  return typeof value === 'string' ? value : null
})
const keyInputKind = computed<'secret' | 'public-key'>(() => (keyInputKindFor(alg.value ?? '', 'verify') === 'secret' ? 'secret' : 'public-key'))
const verifyStale = computed<boolean>(() => lastVerifiedToken !== null && lastVerifiedToken !== input.value)

async function runVerify(): Promise<void> {
  if (!decoded.value?.ok) return
  verifying.value = true
  try {
    verifyResult.value = await verifyJwtSignature(decoded.value.value, keyMaterial.value)
    lastVerifiedToken = input.value
  } finally {
    verifying.value = false
  }
}

watch(input, (): void => {
  verifyResult.value = null
  lastVerifiedToken = null
})

async function copyClaims(): Promise<void> {
  if (decodedJson.value === '') return notify('Nothing to copy yet')
  notify((await copyText(decodedJson.value)) ? 'Copied to clipboard' : 'Copy failed: clipboard unavailable')
}

function downloadClaims(): void {
  if (decodedJson.value === '') return notify('Nothing to download yet')
  const payload = claimsPayload()
  triggerDownload(payload)
  notify(`Downloaded ${payload.filename}`)
}

function clearDecode(): void {
  input.value = ''
  keyMaterial.value = ''
  verifyResult.value = null
  lastVerifiedToken = null
}

async function loadSample(): Promise<void> {
  input.value = await buildJwtSample()
  activeTab.value = 'claims'
}

function onFile(file: LoadedTextFile): void {
  input.value = file.text.trim()
  notify(`Loaded ${file.name}`)
}

// ── Encode mode ──────────────────────────────────────────────────────────────

const encodeHeaderText = ref<string>(ENCODE_SAMPLE_HEADER)
const encodePayloadText = ref<string>(encodeSamplePayload())
const encodeKeyMaterial = ref<string>(JWT_SAMPLE_SECRET)
const encodeResult = shallowRef<Result<SignedJwt> | null>(null)
const encoding = ref<boolean>(false)

const encodeAlg = computed<string | null>(() => {
  try {
    const parsed: unknown = JSON.parse(encodeHeaderText.value)
    const value = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>).alg : null
    return typeof value === 'string' && value !== '' ? value : null
  } catch {
    return null
  }
})
const encodeKeyInputKind = computed<'secret' | 'private-key'>(() =>
  keyInputKindFor(encodeAlg.value ?? '', 'sign') === 'secret' ? 'secret' : 'private-key',
)

function encodeToken(): string {
  return encodeResult.value?.ok ? encodeResult.value.value.token : ''
}

function encodeDownloadPayload(): DownloadPayload {
  return { filename: 'token.jwt', mimeType: 'text/plain', data: encodeToken() }
}

async function runEncode(): Promise<void> {
  encoding.value = true
  try {
    encodeResult.value = await signJwt(encodeHeaderText.value, encodePayloadText.value, encodeKeyMaterial.value)
  } finally {
    encoding.value = false
  }
}

async function copyEncodeToken(): Promise<void> {
  if (encodeToken() === '') return notify('Nothing to copy yet')
  notify((await copyText(encodeToken())) ? 'Copied to clipboard' : 'Copy failed: clipboard unavailable')
}

function downloadEncodeToken(): void {
  if (encodeToken() === '') return notify('Nothing to download yet')
  const payload = encodeDownloadPayload()
  triggerDownload(payload)
  notify(`Downloaded ${payload.filename}`)
}

function loadEncodeSample(): void {
  encodeHeaderText.value = ENCODE_SAMPLE_HEADER
  encodePayloadText.value = encodeSamplePayload()
  encodeKeyMaterial.value = JWT_SAMPLE_SECRET
  encodeResult.value = null
}

function clearEncode(): void {
  encodeHeaderText.value = ''
  encodePayloadText.value = ''
  encodeKeyMaterial.value = ''
  encodeResult.value = null
}

function useEncodedAsInput(): void {
  if (!encodeResult.value?.ok) return
  input.value = encodeResult.value.value.token
  mode.value = 'decode'
  activeTab.value = 'claims'
}

// ── Shared: shortcuts ────────────────────────────────────────────────────────

function runActive(): void {
  if (mode.value === 'encode') return void runEncode()
  if (activeTab.value === 'verify') void runVerify()
}

async function copyPrimary(): Promise<void> {
  if (mode.value === 'encode') return copyEncodeToken()
  return copyClaims()
}

function downloadPrimary(): void {
  if (mode.value === 'encode') return downloadEncodeToken()
  downloadClaims()
}

function clearActive(): void {
  if (mode.value === 'encode') return clearEncode()
  clearDecode()
}

useShortcuts({
  run: runActive,
  copy: (): void => void copyPrimary(),
  download: downloadPrimary,
  clear: clearActive,
  open: (): void => inputDrop.value?.open(),
})

onBeforeUnmount((): void => clearTimeout(noticeTimer))

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-md border border-control-border bg-surface px-3 py-1.5 text-sm hover:bg-background focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const primaryButtonClass =
  'inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
</script>

<template>
  <ToolPage :title="tool.title" :description="tool.description" :icon="tool.icon" :color="tool.color">
    <div class="flex flex-col gap-4 lg:flex-1">
      <div class="flex min-w-0 items-center gap-2">
        <TabList v-model="mode" class="min-w-0 flex-1" :tabs="MODE_TABS" label="JWT mode" id-prefix="jwt-mode" />
        <span aria-live="polite" data-testid="jwt-notice" class="shrink-0 text-sm text-muted">{{ notice }}</span>
      </div>

      <div
        v-show="mode === 'decode'"
        id="jwt-mode-panel-decode"
        role="tabpanel"
        aria-labelledby="jwt-mode-tab-decode"
        class="flex flex-col gap-4 lg:flex-1"
      >
        <div role="toolbar" aria-label="JWT decode actions" class="flex flex-wrap items-center gap-2">
          <button type="button" data-testid="jwt-sample" :class="buttonClass" @click="loadSample">
            <Sparkles class="size-4" aria-hidden="true" />
            Sample
          </button>
          <button type="button" data-testid="jwt-clear" :class="buttonClass" @click="clearDecode">
            <Eraser class="size-4" aria-hidden="true" />
            Clear
          </button>
          <button type="button" data-testid="jwt-open" :class="buttonClass" @click="inputDrop?.open()">
            <FolderOpen class="size-4" aria-hidden="true" />
            Open file
          </button>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:min-h-[max(26rem,calc(100dvh-24rem))] lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
          <FileDrop ref="inputDrop" class="lg:h-full" accept=".jwt,.txt,text/plain" @load="onFile">
            <div class="flex h-9 items-center justify-between gap-4">
              <span class="shrink-0 text-sm font-medium">Token</span>
              <div class="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1" data-testid="jwt-status">
                <StatusBadge v-if="!decoded" tone="muted">Paste a JWT, drop a file, or load the sample.</StatusBadge>
                <StatusBadge v-else-if="decoded.ok" tone="success" data-testid="jwt-valid">Decoded · alg {{ alg }}</StatusBadge>
                <span v-else role="alert" data-testid="jwt-error" class="text-sm text-danger">{{ decoded.error.message }}</span>
              </div>
            </div>
            <div class="h-40 lg:h-auto lg:min-h-0 lg:flex-1 lg:contain-size">
              <CodeEditor
                v-model="input"
                data-testid="jwt-input"
                label="JWT token"
                language="plain"
                wrap
                placeholder="Paste a JWT (header.payload.signature), or drop a .jwt/.txt file…"
              />
            </div>
          </FileDrop>

          <div class="flex min-h-0 min-w-0 flex-col gap-2 lg:h-full">
            <div class="flex min-w-0 items-center gap-2">
              <TabList v-model="activeTab" class="min-w-0 flex-1" :tabs="TABS" label="JWT views" id-prefix="jwt" />
              <div v-if="activeTab === 'claims'" class="flex shrink-0 items-center gap-2">
                <CopyButton :text="decodedJson" compact />
                <DownloadButton :payload="decodedJson === '' ? null : claimsPayload" compact />
              </div>
            </div>

            <div
              v-show="activeTab === 'claims'"
              id="jwt-panel-claims"
              role="tabpanel"
              aria-labelledby="jwt-tab-claims"
              class="min-h-0 overflow-auto lg:flex-1"
            >
              <p v-if="!decoded" data-testid="jwt-claims-empty" class="text-sm text-muted">Paste a JWT to see its header and claims.</p>
              <p v-else-if="!decoded.ok" class="text-sm text-muted">Fix the token to see its header and claims.</p>
              <JwtClaimsTable v-else :header="decoded.value.header" :payload="decoded.value.payload" :timings="decoded.value.timings" />
            </div>

            <div
              v-if="activeTab === 'verify'"
              id="jwt-panel-verify"
              role="tabpanel"
              aria-labelledby="jwt-tab-verify"
              class="flex min-h-0 flex-col gap-3 lg:flex-1"
            >
              <p v-if="!decoded" data-testid="jwt-verify-empty" class="text-sm text-muted">Paste a JWT to verify its signature.</p>
              <p v-else-if="!decoded.ok" class="text-sm text-muted">Fix the token to verify its signature.</p>
              <template v-else>
                <StatusBadge tone="muted" data-testid="jwt-alg">Algorithm: {{ alg }}</StatusBadge>

                <p v-if="alg === 'none'" class="text-sm text-warning">
                  This token declares <code class="font-mono">alg: none</code> — no signature is required. Never trust an unsigned token.
                </p>

                <template v-else>
                  <label for="jwt-verify-key" class="text-sm font-medium">
                    {{ keyInputKind === 'secret' ? 'Shared secret (HMAC)' : 'Public key, PEM (SPKI)' }}
                  </label>
                  <textarea
                    id="jwt-verify-key"
                    v-model="keyMaterial"
                    data-testid="jwt-verify-key"
                    spellcheck="false"
                    autocomplete="off"
                    :rows="keyInputKind === 'secret' ? 2 : 8"
                    :placeholder="keyInputKind === 'secret' ? 'The HMAC secret the token was signed with…' : '-----BEGIN PUBLIC KEY-----…'"
                    class="w-full resize-y rounded-md border border-control-border bg-surface px-3 py-1.5 font-mono text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  />
                </template>

                <button
                  type="button"
                  data-testid="jwt-verify-button"
                  :disabled="verifying"
                  :class="primaryButtonClass"
                  class="self-start"
                  @click="runVerify"
                >
                  <KeyRound class="size-4" aria-hidden="true" />
                  {{ verifying ? 'Verifying…' : 'Verify signature' }}
                </button>

                <StatusBadge v-if="verifyStale" tone="warning">Token changed since the last check. Verify again.</StatusBadge>

                <template v-if="verifyResult">
                  <p v-if="!verifyResult.ok" role="alert" data-testid="jwt-verify-error" class="text-sm text-danger">
                    {{ verifyResult.error.message }}
                  </p>
                  <StatusBadge
                    v-else-if="verifyResult.value.valid"
                    :tone="verifyResult.value.insecure ? 'warning' : 'success'"
                    data-testid="jwt-verify-result"
                  >
                    Signature valid{{ verifyResult.value.insecure ? ' (but unsigned — insecure)' : '' }}
                  </StatusBadge>
                  <StatusBadge v-else tone="danger" data-testid="jwt-verify-result">Signature does not match</StatusBadge>
                </template>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div v-if="mode === 'encode'" id="jwt-mode-panel-encode" role="tabpanel" aria-labelledby="jwt-mode-tab-encode" class="flex flex-col gap-4 lg:flex-1">
        <div role="toolbar" aria-label="JWT encode actions" class="flex flex-wrap items-center gap-2">
          <button type="button" data-testid="jwt-encode-sample" :class="buttonClass" @click="loadEncodeSample">
            <Sparkles class="size-4" aria-hidden="true" />
            Sample
          </button>
          <button type="button" data-testid="jwt-encode-clear" :class="buttonClass" @click="clearEncode">
            <Eraser class="size-4" aria-hidden="true" />
            Clear
          </button>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:min-h-[max(26rem,calc(100dvh-24rem))] lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
          <div class="flex min-h-0 flex-col gap-3 lg:h-full">
            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium">Header (JSON)</span>
              <div class="h-28 lg:h-32">
                <CodeEditor v-model="encodeHeaderText" data-testid="jwt-encode-header" label="Header JSON" />
              </div>
            </div>
            <div class="flex min-h-0 flex-1 flex-col gap-1">
              <span class="text-sm font-medium">Payload (JSON)</span>
              <div class="h-64 lg:h-auto lg:min-h-0 lg:flex-1 lg:contain-size">
                <CodeEditor v-model="encodePayloadText" data-testid="jwt-encode-payload" label="Payload JSON" />
              </div>
            </div>
          </div>

          <div class="flex min-h-0 flex-col gap-3 lg:h-full">
            <StatusBadge tone="muted" data-testid="jwt-encode-alg">Algorithm: {{ encodeAlg ?? 'unknown' }}</StatusBadge>

            <p v-if="encodeAlg === null" data-testid="jwt-encode-alg-missing" class="text-sm text-muted">
              Set a valid "alg" in the header JSON to choose a signing method.
            </p>
            <p v-else-if="encodeAlg === 'none'" class="text-sm text-warning">
              <code class="font-mono">alg: none</code> needs no key — this produces an unsigned, insecure token.
            </p>
            <template v-else>
              <label for="jwt-encode-key" class="text-sm font-medium">
                {{ encodeKeyInputKind === 'secret' ? 'Shared secret (HMAC)' : 'Private key, PEM (PKCS8)' }}
              </label>
              <textarea
                id="jwt-encode-key"
                v-model="encodeKeyMaterial"
                data-testid="jwt-encode-key"
                spellcheck="false"
                autocomplete="off"
                :rows="encodeKeyInputKind === 'secret' ? 2 : 8"
                :placeholder="encodeKeyInputKind === 'secret' ? 'The HMAC secret to sign with…' : '-----BEGIN PRIVATE KEY-----…'"
                class="w-full resize-y rounded-md border border-control-border bg-surface px-3 py-1.5 font-mono text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              />
            </template>

            <button
              type="button"
              data-testid="jwt-encode-generate"
              :disabled="encoding || encodeAlg === null"
              :class="primaryButtonClass"
              class="self-start"
              @click="runEncode"
            >
              <FileSignature class="size-4" aria-hidden="true" />
              {{ encoding ? 'Signing…' : 'Generate token' }}
            </button>

            <p v-if="encodeResult && !encodeResult.ok" role="alert" data-testid="jwt-encode-error" class="text-sm text-danger">
              {{ encodeResult.error.message }}
            </p>

            <template v-if="encodeResult?.ok">
              <div class="flex items-center justify-between gap-2">
                <StatusBadge :tone="encodeResult.value.insecure ? 'warning' : 'success'" data-testid="jwt-encode-result">
                  Token generated{{ encodeResult.value.insecure ? ' (unsigned — insecure)' : '' }}
                </StatusBadge>
                <div class="flex items-center gap-2">
                  <CopyButton :text="encodeToken" compact />
                  <DownloadButton :payload="encodeDownloadPayload" compact />
                </div>
              </div>
              <div class="h-28 lg:h-auto lg:min-h-0 lg:flex-1 lg:contain-size">
                <CodeEditor :model-value="encodeToken()" data-testid="jwt-encode-output" label="Signed token" readonly language="plain" wrap />
              </div>
              <button type="button" data-testid="jwt-encode-use" :class="buttonClass" class="self-start" @click="useEncodedAsInput">
                Decode this token
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </ToolPage>
</template>
