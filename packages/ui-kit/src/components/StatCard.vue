<script setup lang="ts">
defineProps<{ label: string; value: string | number }>()
</script>

<template>
  <div class="stat-card">
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }}</div>
    <div v-if="$slots.foot" class="stat-foot"><slot name="foot" /></div>
  </div>
</template>

<style scoped>
/* .stat-foot không có trong tokens — dòng phụ nhỏ dưới value */
.stat-foot { font-size: 11px; color: var(--muted); margin-top: 4px; }
</style>
