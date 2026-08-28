<script setup lang="ts">
import type { BadgeColor } from '../meta/status-meta'
withDefaults(defineProps<{ color?: BadgeColor }>(), { color: 'gray' })
</script>

<template>
  <span class="badge" :class="color"><slot /></span>
</template>
