<script setup lang="ts">
/**
 * FormField — nhãn + ô nhập + gợi ý + lỗi, gói trong một khối có khoảng cách nhất quán.
 *
 * VÌ SAO CÓ COMPONENT NÀY. `tokens.css` đã có `.field` (nhãn + ô nhập) nhưng KHÔNG có
 * chỗ cho ba thứ mà form thật nào cũng cần: dấu bắt buộc, câu gợi ý dưới ô, và thông báo
 * lỗi của riêng trường đó. Hệ quả là mỗi màn tự chế một kiểu — chỗ dùng `<small>`, chỗ
 * `.field-hint`, chỗ nhét câu giải thích vào placeholder (mất luôn khi người dùng gõ).
 * Nhìn tổng thể thì form của các màn "same same but different", và đó chính là cảm giác
 * giao diện luộm thuộm.
 *
 * TRƯỜNG CHỈ ĐỌC KHÔNG PHẢI Ô NHẬP BỊ KHOÁ. `readonly` render ra chữ, không phải
 * `<input disabled>`: ô xám vẫn trông như thứ bấm vào được, người dùng bấm, không gõ
 * được, rồi mất vài giây đoán vì sao. Kèm `readonlyReason` để nói thẳng vì sao — trường
 * do hệ khác sở hữu là chuyện thường trong hệ tích hợp.
 *
 * Dùng:
 *   <FormField label="Tên hàng" required hint="Tên hiện trên đơn nội bộ">
 *     <input v-model="ten" />
 *   </FormField>
 *
 *   <FormField label="Giá vốn" readonly :value="giaVon" readonly-reason="ERP sở hữu" />
 */
defineProps<{
  label?: string
  /** Hiện dấu * đỏ. Chỉ là dấu hiệu thị giác — chốt chặn thật vẫn ở phía server. */
  required?: boolean
  /** Câu giải thích dưới ô. KHÔNG dùng placeholder để giải thích: nó biến mất khi gõ. */
  hint?: string
  /** Có giá trị ⇒ viền đỏ + hiện câu lỗi, và câu lỗi THAY chỗ gợi ý để không chen nhau. */
  error?: string
  /** Render chữ thay vì ô nhập. */
  readonly?: boolean
  /** Giá trị hiện khi readonly. */
  value?: string | number | null
  /** Vì sao trường này không sửa được — nói ra thì người dùng khỏi đoán. */
  readonlyReason?: string
  /**
   * id của ô nhập trong slot, để bấm nhãn là con trỏ nhảy vào đúng ô.
   *
   * Tên là `labelFor` chứ không phải `for`: `for` là từ khoá của JS nên trình biên dịch
   * macro `defineProps` của Vue báo lỗi cú pháp ở đúng dòng khai kiểu.
   */
  labelFor?: string
}>()
</script>

<template>
  <div class="field ui-ff" :class="{ 'ui-ff-loi': !!error }">
    <label v-if="label" :for="labelFor">
      {{ label }}<span v-if="required" class="ui-ff-sao" aria-hidden="true">*</span>
    </label>

    <template v-if="readonly">
      <div class="ui-ff-chi-doc">
        <span v-if="value !== null && value !== undefined && value !== ''">{{ value }}</span>
        <span v-else class="ui-ff-trong">—</span>
      </div>
      <small v-if="readonlyReason" class="ui-ff-hint">
        <i class="ti ti-lock" aria-hidden="true"></i> {{ readonlyReason }}
      </small>
    </template>

    <slot v-else />

    <small v-if="error" class="ui-ff-loi-text">{{ error }}</small>
    <small v-else-if="hint && !readonly" class="ui-ff-hint">{{ hint }}</small>
  </div>
</template>

<style scoped>
/* Khoảng cách do FormGrid quản (gap), nên bỏ margin mặc định của .field để hai cơ chế
   không cộng dồn thành khoảng trống lệch nhau giữa các hàng. */
.ui-ff { margin-bottom: 0; }
.ui-ff-sao { color: var(--danger); margin-left: 3px; }
.ui-ff-hint {
  display: block; margin-top: 5px; font-size: 11.8px; line-height: 1.5; color: var(--muted);
}
.ui-ff-loi-text {
  display: block; margin-top: 5px; font-size: 11.8px; line-height: 1.5;
  color: var(--danger); font-weight: 600;
}
/* Viền đỏ đặt ở :deep vì ô nhập nằm trong slot ⇒ thuộc phạm vi của component cha. */
.ui-ff-loi :deep(input),
.ui-ff-loi :deep(select),
.ui-ff-loi :deep(textarea) { border-color: var(--danger); }

/* Chỉ đọc: CHỮ, không phải ô xám. Ô xám vẫn mời người ta bấm vào. */
.ui-ff-chi-doc {
  padding: 10px 12px; border: 1px dashed var(--border); border-radius: 9px;
  background: var(--gray-bg); color: var(--ink); min-height: 40px;
  display: flex; align-items: center; word-break: break-word;
}
.ui-ff-trong { color: var(--border); }
</style>
