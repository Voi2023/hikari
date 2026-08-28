<script setup lang="ts">
import type { Locale } from '../meta/status-meta'
const props = withDefaults(defineProps<{ message?: string; locale?: Locale }>(), { locale: 'vi' })
defineEmits<{ retry: [] }>()
const retryLabel = props.locale === 'en' ? 'Retry' : 'Thử lại'
</script>

<template>
  <div class="state-error">
    <div class="ic"><i class="ti ti-alert-triangle" aria-hidden="true"></i></div>
    <p>{{ message || (locale === 'en' ? 'Something went wrong' : 'Đã có lỗi xảy ra') }}</p>
    <button class="btn btn-outline btn-sm" @click="$emit('retry')">
      <i class="ti ti-refresh" aria-hidden="true"></i> {{ retryLabel }}
    </button>
  </div>
</template>
