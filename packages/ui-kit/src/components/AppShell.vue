<script setup lang="ts">
// Khung app chuẩn: sidebar + topbar + slot tabbar + nội dung.
// Dùng class app-shell/app-sidebar/app-topbar… từ @hikari/design-tokens.
import { ref } from 'vue'
withDefaults(defineProps<{
  portalLabel?: string     // nhãn pill, vd 'Cổng Nhân viên'
  partner?: boolean        // cổng đối tác → dải accent + pill vàng
  logoSrc?: string
  title?: string
}>(), { portalLabel: '', partner: false })
const emit = defineEmits<{ requestDebug: [] }>()
const open = ref(false)          // mobile: trượt sidebar ra/vào

// Bấm logo/chữ mark 8 lần liên tiếp (trong 4s) → yêu cầu mở Debug Console (rule FE §3c)
let logoClicks = 0
let logoTimer: ReturnType<typeof setTimeout> | undefined
function onLogoClick() {
  logoClicks += 1
  clearTimeout(logoTimer)
  logoTimer = setTimeout(() => { logoClicks = 0 }, 4000)
  if (logoClicks >= 8) { logoClicks = 0; clearTimeout(logoTimer); emit('requestDebug') }
}

// Thu gọn sidebar thành thanh icon (desktop) — bền qua refresh (sessionStorage, không dùng localStorage)
const RAIL_KEY = 'hikari_nav_rail'
const collapsed = ref(false)
try { collapsed.value = sessionStorage.getItem(RAIL_KEY) === '1' } catch { /* bỏ qua */ }
function toggleRail() {
  collapsed.value = !collapsed.value
  try { sessionStorage.setItem(RAIL_KEY, collapsed.value ? '1' : '0') } catch { /* bỏ qua */ }
}
</script>

<template>
  <div class="app-shell" :class="{ 'portal-partner': partner }">
    <aside class="app-sidebar" :class="{ open, collapsed }">
      <div class="app-brand">
        <div class="brand-row">
          <img v-if="logoSrc" class="logo-img" :src="logoSrc" alt="Logo" data-test="app-logo" style="cursor:pointer" @click="onLogoClick" />
          <span class="brand-mark" aria-hidden="true" data-test="brand-mark" style="cursor:pointer" @click="onLogoClick">H</span>
          <button class="rail-btn" type="button" :title="collapsed ? 'Mở rộng menu' : 'Thu gọn menu'" aria-label="Thu gọn menu" @click="toggleRail">
            <i :class="['ti', collapsed ? 'ti-chevron-right' : 'ti-chevron-left']"></i>
          </button>
        </div>
        <span v-if="portalLabel" class="portal-pill" :class="{ partner }"><span class="dot"></span> {{ portalLabel }}</span>
      </div>
      <nav class="app-nav"><slot name="nav" /></nav>
      <div v-if="$slots.user" class="app-user"><slot name="user" /></div>
    </aside>

    <div class="app-main">
      <header class="app-topbar">
        <div class="tb-left">
          <button class="menu-btn" type="button" @click="open = !open" aria-label="Menu"><i class="ti ti-menu-2"></i></button>
          <h1><slot name="title">{{ title }}</slot></h1>
        </div>
        <div class="tb-right"><slot name="topbar-actions" /></div>
      </header>

      <slot name="tabbar" />

      <div class="app-content"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.tb-left, .tb-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
</style>
