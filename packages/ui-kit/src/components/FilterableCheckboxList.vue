<script setup lang="ts">
// Danh sách chọn nhiều mục CÓ LỌC (ui-ux/core.mdc §10) — dùng cho catalog ≥ ~15 mục.
import { computed, ref } from 'vue'

export interface CheckItem { value: string; label: string; meta?: string; disabled?: boolean }

const props = defineProps<{
  items: CheckItem[]
  modelValue: string[]
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const q = ref('')
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return props.items
  return props.items.filter(i =>
    i.value.toLowerCase().includes(s) || i.label.toLowerCase().includes(s) || (i.meta ?? '').toLowerCase().includes(s))
})
const selectedCount = computed(() => props.modelValue.length)

function toggle(v: string) {
  const set = new Set(props.modelValue)
  set.has(v) ? set.delete(v) : set.add(v)
  emit('update:modelValue', [...set])
}
function selectAllFiltered() {
  const set = new Set(props.modelValue)
  filtered.value.forEach(i => { if (!i.disabled) set.add(i.value) })
  emit('update:modelValue', [...set])
}
function clearFiltered() {
  const rm = new Set(filtered.value.map(i => i.value))
  emit('update:modelValue', props.modelValue.filter(v => !rm.has(v)))
}
</script>

<template>
  <div class="fcl">
    <div class="toolbar" style="margin-bottom:8px">
      <input type="search" v-model="q" :placeholder="placeholder || 'Lọc theo mã / tên…'" />
      <span style="flex:1"></span>
      <button class="btn btn-ghost btn-sm" type="button" @click="selectAllFiltered">Chọn tất cả (đang lọc)</button>
      <button class="btn btn-ghost btn-sm" type="button" @click="clearFiltered">Bỏ chọn (đang lọc)</button>
    </div>
    <div class="pick-list">
      <label v-for="i in filtered" :key="i.value" class="pick-item" :class="{ blocked: i.disabled }">
        <input type="checkbox" :checked="modelValue.includes(i.value)" :disabled="i.disabled" @change="toggle(i.value)" />
        <div>
          <b class="mono">{{ i.value }}</b> <span v-if="i.label">· {{ i.label }}</span>
          <div v-if="i.meta" class="meta">{{ i.meta }}</div>
        </div>
      </label>
      <div v-if="!filtered.length" class="empty-state" style="padding:20px">Không có mục khớp.</div>
    </div>
    <p class="report-sub">Đã chọn {{ selectedCount }} / {{ items.length }}</p>
  </div>
</template>

<style scoped>
/* Các class .pick-list/.pick-item/.meta là tiện ích của FilterableCheckboxList — không nằm trong tokens */
.fcl .pick-list { max-height: 420px; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius); padding: 6px; }
.fcl .pick-item { display: flex; gap: 10px; align-items: center; padding: 9px 10px; border-radius: 8px; cursor: pointer; }
.fcl .pick-item:hover { background: var(--bg); }
.fcl .pick-item.blocked { opacity: .55; cursor: not-allowed; }
.fcl .pick-item input { width: 16px; height: 16px; accent-color: var(--brand); }
.fcl .pick-item .meta { font-size: 11.5px; color: var(--muted); }
</style>
