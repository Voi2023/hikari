<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <section class="panel">
    <h2 v-if="title || $slots.title || $slots.actions">
      <span><slot name="title">{{ title }}</slot></span>
      <slot name="actions" />
    </h2>
    <slot />
  </section>
</template>
