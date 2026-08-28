<script setup lang="ts">
// Badge trạng thái — nhãn + màu lấy từ *_META (KHÔNG tự viết nhãn trong view).
// `kind` chọn bảng nghĩa: order (mặc định) | payment | shipment | sync | notify | fulfilment | tier | role.
// Cùng mã "FAILED" mang nghĩa khác nhau ở thanh toán / giao hàng / đồng bộ, nên phải nói rõ bảng nào.
import { computed } from 'vue'
import { meta, type Locale, type MetaKind } from '../meta/status-meta'
const props = withDefaults(defineProps<{ status: string; kind?: MetaKind; locale?: Locale }>(), {
  kind: 'order', locale: 'vi',
})
const m = computed(() => meta(props.kind, props.status, props.locale))
</script>

<template>
  <span class="badge" :class="m.color">{{ m.label }}</span>
</template>
