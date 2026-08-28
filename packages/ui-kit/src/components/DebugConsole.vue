<script setup lang="ts">
// Debug Console — panel nổi hiển thị MỌI lời gọi API để debug ngay trên production.
// Chỉ hiện sau khi mở khoá bằng mật khẩu (kiểm ở server). Chỉ thấy dữ liệu user đã có quyền.
import { ref } from 'vue'
import type { ApiTrace } from '../api'

defineProps<{ logs: ApiTrace[]; locale: string }>()
const emit = defineEmits<{ close: []; clear: [] }>()

const expanded = ref<number | null>(null)
function toggle(i: number) { expanded.value = expanded.value === i ? null : i }
function statusColor(s: number): string {
  if (s === 0 || s >= 500) return 'var(--danger)'
  if (s >= 400) return 'var(--warn, #f79009)'
  return 'var(--ok, #12b76a)'
}
function pretty(v: unknown): string {
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}
</script>
<template>
  <div class="debug-console" data-test="debug-console">
    <div class="debug-head">
      <b>🐞 Debug Console</b>
      <span class="debug-count">{{ logs.length }} {{ locale === 'en' ? 'calls' : 'lượt gọi' }}</span>
      <span style="flex:1"></span>
      <button class="btn btn-ghost btn-sm" data-test="debug-clear" @click="emit('clear')">{{ locale === 'en' ? 'Clear' : 'Xoá' }}</button>
      <button class="btn btn-ghost btn-sm" data-test="debug-close" @click="emit('close')">✕</button>
    </div>
    <div class="debug-body">
      <div v-if="!logs.length" class="debug-empty">{{ locale === 'en' ? 'No API calls captured yet.' : 'Chưa ghi nhận lời gọi API nào.' }}</div>
      <div v-for="(t, i) in logs" :key="i" class="debug-row" :data-test="`debug-row-${i}`">
        <div class="debug-line" @click="toggle(i)">
          <span class="debug-status" :style="{ color: statusColor(t.status) }">{{ t.status || 'ERR' }}</span>
          <span class="debug-method">{{ t.method }}</span>
          <span class="debug-path">{{ t.path }}</span>
          <span class="debug-ms">{{ t.ms }}ms</span>
        </div>
        <div v-if="expanded === i" class="debug-detail">
          <div class="debug-kv">{{ locale === 'en' ? 'Time' : 'Thời điểm' }}: {{ t.ts }}</div>
          <template v-if="t.requestBody !== undefined && t.requestBody !== null">
            <div class="debug-kv">Request:</div><pre>{{ pretty(t.requestBody) }}</pre>
          </template>
          <template v-if="t.response !== undefined">
            <div class="debug-kv">Response:</div><pre>{{ pretty(t.response) }}</pre>
          </template>
          <template v-if="t.error">
            <div class="debug-kv" style="color:var(--danger)">Error: {{ t.error }}</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.debug-console { position: fixed; right: 16px; bottom: 16px; z-index: 9999; width: min(560px, calc(100vw - 32px)); max-height: 60vh; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.28); font-size: 12.5px; overflow: hidden; }
.debug-head { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--border); background: var(--warn-bg, #fff8e1); }
.debug-count { font-size: 11.5px; color: var(--muted); }
.debug-body { overflow-y: auto; }
.debug-empty { padding: 22px; text-align: center; color: var(--muted); }
.debug-row { border-bottom: 1px solid var(--border); }
.debug-line { display: flex; align-items: center; gap: 8px; padding: 7px 12px; cursor: pointer; font-family: ui-monospace, monospace; }
.debug-line:hover { background: var(--gray-bg, #f4f6f9); }
.debug-status { font-weight: 800; min-width: 32px; }
.debug-method { font-weight: 700; min-width: 46px; }
.debug-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.debug-ms { color: var(--muted); }
.debug-detail { padding: 8px 12px; background: var(--gray-bg, #f4f6f9); }
.debug-kv { font-weight: 700; margin: 6px 0 2px; }
.debug-detail pre { margin: 0; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; overflow-x: auto; max-height: 220px; font-size: 11.5px; }
</style>
