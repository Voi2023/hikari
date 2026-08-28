<script setup lang="ts">
// Thanh đa-tab (cửa sổ toàn app). Dùng kèm useTabs. Bền qua refresh do useTabs lo (sessionStorage).
import type { TabItem } from '../composables/useTabs'
// Lưu ý: prop kiểu Boolean khi KHÔNG truyền sẽ bị Vue ép thành false → phải withDefaults(closable:true)
// để nút đóng hiện mặc định (bug cũ: `closable ?? true` vô dụng vì closable = false, không phải undefined).
withDefaults(defineProps<{ tabs: TabItem[]; active: string; closable?: boolean }>(), { closable: true })
const emit = defineEmits<{ activate: [string]; close: [string] }>()
</script>

<template>
  <div class="tabbar">
    <div
      v-for="t in tabs"
      :key="t.key"
      class="tab"
      :class="{ active: t.key === active }"
      @click="emit('activate', t.key)"
    >
      <i v-if="t.icon" :class="['ti', t.icon]" aria-hidden="true"></i>
      <span>{{ t.title }}</span>
      <button
        v-if="closable && t.closable !== false"
        type="button"
        class="x"
        title="Đóng tab"
        aria-label="Đóng tab"
        @click.stop="emit('close', t.key)"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Tab kiểu "folder" đồng bộ với Warranty: nền brand-tint, viền brand, active có thanh brand trên. */
.tabbar { display: flex; align-items: stretch; gap: 6px; overflow-x: auto; background: var(--brand-tint); border-bottom: 2px solid var(--brand); padding: 9px 14px 0; }
.tab { display: inline-flex; align-items: center; gap: 8px; max-width: 230px; flex: 0 0 auto; border: 1px solid var(--border); border-bottom: none; background: var(--surface); color: var(--ink); border-radius: 10px 10px 0 0; padding: 9px 12px 10px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background .12s, color .12s, box-shadow .12s; }
.tab:hover { background: #fff; box-shadow: 0 -1px 6px rgba(0,91,172,.1); }
.tab.active { color: var(--brand); background: #fff; border-color: var(--brand); font-weight: 700; box-shadow: inset 0 3px 0 0 var(--brand); }
.tab i:first-child { font-size: 14px; opacity: .95; }
.tab span { overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
.tab .x { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; padding: 0; border: none; background: transparent; color: var(--muted); border-radius: 50%; cursor: pointer; flex: none; transition: background .12s, color .12s; }
.tab .x:hover { color: #fff; background: var(--danger, #d92d20); }
.tab .x svg { display: block; }
</style>
