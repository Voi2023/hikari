<script setup lang="ts">
/**
 * FormSection — một nhóm trường có tiêu đề nhỏ và lưới cột.
 *
 * VÌ SAO CÓ COMPONENT NÀY. Form dài mà phẳng lì là dạng "xấu" khó chỉ tên nhất: mọi
 * trường trông ngang hàng nhau nên mắt không biết dừng ở đâu, và người dùng phải đọc
 * từng nhãn để tự gom nhóm trong đầu. Chia nhóm có tiêu đề thì mỗi khối trả lời một câu
 * hỏi ("cái này là gì" / "kho xử lý thế nào"), và người dùng bỏ qua được khối không liên
 * quan tới việc đang làm.
 *
 * `desc` không phải trang trí: đây là chỗ nói ĐIỀU KIỆN của cả nhóm — ví dụ "ERP sở hữu
 * những trường này" — thay vì lặp lại câu đó ở từng trường.
 *
 * Dùng:
 *   <FormSection title="Định danh" desc="Không đổi được sau khi tạo" :cols="2">
 *     <FormField …/> <FormField …/>
 *   </FormSection>
 */
withDefaults(
  defineProps<{
    title?: string
    desc?: string
    /** Số cột trên màn rộng. Dưới 720px luôn về 1 cột. */
    cols?: 1 | 2 | 3
    /** Nhóm cảnh báo: viền vàng, dùng khi cả nhóm có ràng buộc cần đọc trước khi sửa. */
    warn?: boolean
  }>(),
  { cols: 2 },
)
</script>

<template>
  <section class="ui-fs" :class="{ 'ui-fs-warn': warn }">
    <header v-if="title || desc || $slots.actions" class="ui-fs-head">
      <div>
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="desc">{{ desc }}</p>
      </div>
      <slot name="actions" />
    </header>
    <div class="ui-fs-grid" :class="`c${cols}`">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.ui-fs { margin-bottom: 20px; }
.ui-fs:last-child { margin-bottom: 0; }
.ui-fs-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
}
.ui-fs-head h3 {
  margin: 0; font-size: 12.5px; font-weight: 800; color: var(--muted);
  text-transform: uppercase; letter-spacing: .04em;
}
.ui-fs-head p { margin: 4px 0 0; font-size: 12.2px; line-height: 1.55; color: var(--muted); }

.ui-fs-grid { display: grid; gap: 14px 16px; }
.ui-fs-grid.c1 { grid-template-columns: 1fr; }
.ui-fs-grid.c2 { grid-template-columns: 1fr 1fr; }
.ui-fs-grid.c3 { grid-template-columns: 1fr 1fr 1fr; }
/* Một cột dưới 720px: hai ô nhập cạnh nhau trên màn hẹp thì ô nào cũng quá ngắn để đọc
   được nội dung đang gõ. */
@media (max-width: 720px) {
  .ui-fs-grid.c2, .ui-fs-grid.c3 { grid-template-columns: 1fr; }
}
/* Trường cần cả hàng (tên dài, mô tả): đặt class="ui-rong" lên chính FormField. */
.ui-fs-grid :deep(.ui-rong) { grid-column: 1 / -1; }

.ui-fs-warn {
  background: var(--warn-bg); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 13px 15px;
}
.ui-fs-warn .ui-fs-head { border-bottom-color: rgba(0, 0, 0, .08); }
</style>
