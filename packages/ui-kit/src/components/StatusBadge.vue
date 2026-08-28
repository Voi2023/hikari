<script setup lang="ts">
// Badge trạng thái đơn — nhãn + màu lấy từ STATUS_META (KHÔNG tự viết nhãn trong view).
import { computed } from 'vue'
import { statusColor, statusLabel, type Locale } from '../meta/status-meta'
const props = withDefaults(defineProps<{ status: string; locale?: Locale }>(), { locale: 'vi' })
const color = computed(() => statusColor(props.status))
const label = computed(() => statusLabel(props.status, props.locale))
</script>

<template>
  <span class="badge" :class="color">{{ label }}</span>
</template>
