<script setup lang="ts">
// Tab con trong 1 trang (segmented) — khác TabBar (tab cửa sổ toàn app).
export interface TabDef { key: string; label: string }
defineProps<{ modelValue: string; tabs: TabDef[] }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <div class="tabs">
    <button
      v-for="t in tabs"
      :key="t.key"
      :class="{ active: t.key === modelValue }"
      @click="emit('update:modelValue', t.key)"
    >{{ t.label }}</button>
  </div>
</template>
