<script setup lang="ts">
export interface TimelineItem { status: string; meta?: string; note?: string }
defineProps<{ items: TimelineItem[] }>()
</script>

<template>
  <ul class="timeline">
    <li v-for="(it, i) in items" :key="i">
      <div class="t-status">{{ it.status }}</div>
      <div v-if="it.meta" class="t-meta">{{ it.meta }}</div>
      <div v-if="it.note" class="t-note">{{ it.note }}</div>
    </li>
  </ul>
</template>
