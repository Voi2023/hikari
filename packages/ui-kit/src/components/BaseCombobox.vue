<script setup lang="ts">
// Combobox chọn có TÌM KIẾM (single/multi). Dùng cho danh mục dài: chi nhánh, site, MC…
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export interface ComboOption { value: string; label: string; meta?: string; disabled?: boolean }

const props = withDefaults(defineProps<{
  modelValue: string | string[] | null
  options: ComboOption[]
  placeholder?: string
  multiple?: boolean
  disabled?: boolean
}>(), { placeholder: 'Tìm & chọn…', multiple: false })

const emit = defineEmits<{ 'update:modelValue': [string | string[]] }>()

const root = ref<HTMLElement | null>(null)
const inp = ref<HTMLInputElement | null>(null)
const open = ref(false)
const q = ref('')
const active = ref(0)

const selected = computed<string[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue : (props.modelValue ? [props.modelValue] : []))
const selectedOptions = computed(() => props.options.filter(o => selected.value.includes(o.value)))
const singleLabel = computed(() => selectedOptions.value[0]?.label ?? '')

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  return props.options.filter(o => {
    if (props.multiple && selected.value.includes(o.value)) return false
    if (!s) return true
    return o.value.toLowerCase().includes(s) || o.label.toLowerCase().includes(s) || (o.meta ?? '').toLowerCase().includes(s)
  })
})

function focusInput() { if (!props.disabled) inp.value?.focus() }
function openList() { if (props.disabled) return; open.value = true; active.value = 0 }
function close() { open.value = false; q.value = '' }
function pick(o: ComboOption) {
  if (o.disabled) return
  if (props.multiple) { emit('update:modelValue', [...selected.value, o.value]); q.value = ''; active.value = 0; inp.value?.focus() }
  else { emit('update:modelValue', o.value); close() }
}
function removeChip(v: string) {
  emit('update:modelValue', selected.value.filter(x => x !== v))
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { active.value = Math.min(active.value + 1, filtered.value.length - 1); e.preventDefault() }
  else if (e.key === 'ArrowUp') { active.value = Math.max(active.value - 1, 0); e.preventDefault() }
  else if (e.key === 'Enter') { const o = filtered.value[active.value]; if (o) pick(o); e.preventDefault() }
  else if (e.key === 'Escape') { close() }
  else if (e.key === 'Backspace' && !q.value && props.multiple && selected.value.length) { removeChip(selected.value[selected.value.length - 1]) }
  else { open.value = true }
}
function onDocClick(e: MouseEvent) { if (root.value && !root.value.contains(e.target as Node)) open.value = false }
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div class="combo" :class="{ disabled }" ref="root">
    <div class="combo-box" :class="{ open }" @click="focusInput">
      <span v-for="o in (multiple ? selectedOptions : [])" :key="o.value" class="combo-chip">
        {{ o.label }} <i class="ti ti-x" @click.stop="removeChip(o.value)"></i>
      </span>
      <input
        ref="inp"
        class="combo-input"
        v-model="q"
        :disabled="disabled"
        :placeholder="!multiple && singleLabel && !open ? singleLabel : placeholder"
        @focus="openList"
        @keydown="onKey"
        autocomplete="off"
      />
      <i class="ti ti-chevron-down combo-caret" :class="{ open }"></i>
    </div>
    <div v-if="open" class="combo-list">
      <div
        v-for="(o, i) in filtered"
        :key="o.value"
        class="combo-opt"
        :class="{ active: i === active, off: o.disabled }"
        @mouseenter="active = i"
        @mousedown.prevent="pick(o)"
      >
        <b class="mono">{{ o.value }}</b> · {{ o.label }}<span v-if="o.meta" class="meta"> — {{ o.meta }}</span>
      </div>
      <div v-if="!filtered.length" class="combo-empty">Không tìm thấy.</div>
    </div>
  </div>
</template>

<style scoped>
.combo { position: relative; }
.combo-box { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 34px; padding: 4px 30px 4px 8px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); cursor: text; position: relative; }
.combo-box.open { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.combo.disabled .combo-box { background: var(--gray-bg); cursor: not-allowed; }
.combo-input { flex: 1; min-width: 80px; border: none; outline: none; background: transparent; font: inherit; font-size: 13.5px; padding: 3px 0; }
.combo-chip { display: inline-flex; align-items: center; gap: 5px; background: var(--brand-tint); color: var(--brand-dark); border-radius: var(--radius-full); padding: 2px 9px; font-size: 12px; font-weight: 600; }
.combo-chip i { cursor: pointer; font-size: 13px; opacity: .7; }
.combo-chip i:hover { opacity: 1; }
.combo-caret { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); color: var(--muted); transition: transform .15s; }
.combo-caret.open { transform: translateY(-50%) rotate(180deg); }
.combo-list { position: absolute; z-index: 50; left: 0; right: 0; top: calc(100% + 4px); max-height: 260px; overflow: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); padding: 4px; }
.combo-opt { padding: 8px 10px; border-radius: 7px; cursor: pointer; font-size: 13px; }
.combo-opt.active { background: var(--brand-tint); }
.combo-opt.off { opacity: .5; cursor: not-allowed; }
.combo-opt .meta { font-size: 11.5px; color: var(--muted); }
.combo-empty { padding: 10px; color: var(--muted); font-size: 12.5px; }
</style>
