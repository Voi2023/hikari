<script setup lang="ts">
// Modal chuẩn: mặc định 440px; nội dung có bảng+form dùng lg (720px). v-model điều khiển mở/đóng.
const props = defineProps<{
  modelValue: boolean
  title?: string
  sub?: string
  lg?: boolean
  /**
   * ECOM_persistent — bấm ra ngoài KHÔNG đóng modal, và hiện NÚT ĐÓNG (×) ở góc phải.
   *
   * Mặc định `false` để giữ nguyên hành vi lẫn giao diện cũ cho mọi màn đang dùng.
   *
   * Bật cho modal có NHẬP LIỆU. Bấm hụt ra nền là thao tác rất dễ xảy ra, và khi modal
   * đóng thì toàn bộ nội dung đang gõ mất sạch — không cảnh báo, không hoàn tác. Người
   * dùng thường không nhận ra mình vừa bấm ra ngoài, nên họ đọc nó là "hệ thống tự nhiên
   * xoá mất dữ liệu". Đã gặp thật ở dmcl.ecom 07/08/2026.
   *
   * Nút × đi KÈM cờ này chứ không phải một prop riêng, vì hai thứ là một quyết định: bỏ
   * đường thoát bằng cách bấm nền thì phải trả lại một đường thoát nhìn thấy được. Tách
   * làm hai prop là mở ra tổ hợp "persistent mà không có nút đóng" — tức là nhốt người
   * dùng, và không ai chọn tổ hợp đó một cách có chủ ý.
   */
  persistent?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
function close() { emit('update:modelValue', false) }
function bamNen() { if (!props.persistent) close() }
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="bamNen">
      <div class="modal" :class="{ 'modal-lg': lg }">
        <!-- Hàng tiêu đề chỉ dựng khi CÓ thứ để hiện. Dựng vô điều kiện thì modal không
             title sẽ mọc thêm một khoảng trống ở đầu. -->
        <div v-if="title || persistent" class="ui-modal-head">
          <h3 v-if="title">{{ title }}</h3>
          <button
            v-if="persistent"
            type="button"
            class="ui-modal-x"
            aria-label="Đóng"
            title="Đóng"
            @click="close"
          >
            <!-- Ký tự × (U+00D7), KHÔNG phải chữ x: chữ x lệch tâm và trông như nội dung.
                 Dùng icon font cũng được, nhưng thế là buộc mọi dự án dùng kit phải nạp
                 font đó chỉ để đóng một modal. -->
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <p v-if="sub" class="sub">{{ sub }}</p>
        <slot />
        <div v-if="$slots.actions" class="actions"><slot name="actions" /></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Tiền tố .ui-modal-* — tokens.css không có lớp nào cho hàng tiêu đề của modal, và đặt
   tên trơn (.head, .close) trong một component dùng chung là mời đụng độ. */
.ui-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

/* h3 trong tokens.css có margin-bottom 6px — giữ nguyên, chỉ bỏ phần thừa để hàng cân. */
.ui-modal-head h3 { flex: 1; min-width: 0; }

.ui-modal-x {
  flex: none;
  /* Vùng bấm 32px: nhỏ hơn thì trên màn cảm ứng rất dễ bấm trượt ra nền — mà nền thì
     giờ không đóng nữa, nên người dùng bấm mãi không thoát được. */
  width: 32px;
  height: 32px;
  margin: -6px -6px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transition: background .12s, color .12s;
}
/* --ink là màu chữ chính. KHÔNG có biến --text trong tokens.css. */
.ui-modal-x:hover { background: var(--gray-bg); color: var(--ink); }
.ui-modal-x:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
</style>
