<script setup lang="ts">
defineProps<{ icon?: string; text?: string }>()
</script>

<template>
  <div class="empty-state">
    <i v-if="icon" :class="['ti', icon]" style="font-size:30px" aria-hidden="true"></i>
    <p><slot>{{ text }}</slot></p>
  </div>
</template>
