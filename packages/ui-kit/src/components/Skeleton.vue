<script setup lang="ts">
// Trạng thái tải (rule FE §3d). variant: stats | table | detail
withDefaults(defineProps<{ variant?: 'stats' | 'table' | 'detail'; rows?: number }>(), { variant: 'detail', rows: 4 })
</script>

<template>
  <div v-if="variant === 'stats'" class="stat-grid">
    <div v-for="n in 4" :key="n" class="skeleton sk-stat"></div>
  </div>

  <div v-else-if="variant === 'table'" class="sk-panel">
    <div class="skeleton sk-line lg" style="width:40%"></div>
    <div v-for="n in rows" :key="n" class="skeleton sk-line"></div>
  </div>

  <div v-else class="sk-panel">
    <div class="skeleton sk-line lg" style="width:50%"></div>
    <div v-for="n in rows" :key="n" class="skeleton sk-line" :style="{ width: (60 + (n * 7) % 30) + '%' }"></div>
  </div>
</template>
