<script setup lang="ts">
// Nút chuẩn — map prop → class design-tokens (.btn .btn-primary/-outline/-ghost/-danger/-sm)
withDefaults(defineProps<{
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  sm?: boolean
  icon?: string            // class Tabler, vd 'ti-check'
  type?: 'button' | 'submit'
  disabled?: boolean
}>(), { variant: 'primary', type: 'button' })
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="btn"
    :class="[`btn-${variant}`, { 'btn-sm': sm }]"
  >
    <i v-if="icon" :class="['ti', icon]" aria-hidden="true"></i>
    <slot />
  </button>
</template>
