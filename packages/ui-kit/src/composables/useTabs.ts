import { ref, watch, type Ref } from 'vue'

export interface TabItem {
  key: string          // định danh tab (route/màn hình); mỗi key đúng 1 tab
  title: string
  icon?: string        // class Tabler, vd 'ti-package'
  closable?: boolean   // false = tab ghim (không hiện nút đóng), vd Bảng điều khiển
}

export interface UseTabsOptions {
  storageKey?: string  // key sessionStorage để bền qua refresh (mặc định 'hikari_tabs')
  initial?: TabItem[]  // tab mở sẵn khi chưa có state lưu
}

interface Persisted { tabs: TabItem[]; active: string }

/**
 * Quản lý đa-tab (core.mdc §4b): mở/đóng/active + BỀN QUA REFRESH bằng sessionStorage.
 * KHÔNG dùng localStorage (rule FE §1 chỉ cho token/user/locale).
 */
export function useTabs(opts: UseTabsOptions = {}) {
  const storageKey = opts.storageKey ?? 'hikari_tabs'
  const initial = opts.initial ?? []

  const tabs: Ref<TabItem[]> = ref(initial)
  const active = ref<string>(initial[0]?.key ?? '')

  // Khôi phục từ sessionStorage lúc khởi động
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (raw) {
      const s = JSON.parse(raw) as Persisted
      if (s?.tabs?.length) {
        tabs.value = s.tabs
        active.value = s.tabs.some(t => t.key === s.active) ? s.active : s.tabs[0].key
      }
    }
  } catch { /* bỏ qua */ }

  function persist() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ tabs: tabs.value, active: active.value } as Persisted))
    } catch { /* bỏ qua */ }
  }
  watch([tabs, active], persist, { deep: true })

  /** Mở tab (hoặc focus nếu đã mở — mỗi key đúng 1 tab). */
  function open(tab: TabItem) {
    const existing = tabs.value.find(t => t.key === tab.key)
    if (!existing) tabs.value.push(tab)
    else if (tab.closable !== undefined) existing.closable = tab.closable // cập nhật cờ ghim cho tab khôi phục từ session cũ
    active.value = tab.key
  }

  function activate(key: string) { active.value = key }

  /** Đóng tab; nếu đóng tab active thì nhảy sang tab lân cận. Tab ghim (closable===false) không đóng. */
  function close(key: string) {
    const i = tabs.value.findIndex(t => t.key === key)
    if (i < 0 || tabs.value[i].closable === false) return
    tabs.value.splice(i, 1)
    if (active.value === key) {
      active.value = tabs.value[Math.max(0, i - 1)]?.key ?? ''
    }
  }

  /** Xoá toàn bộ tab (vd khi logout). */
  function reset() { tabs.value = []; active.value = ''; persist() }

  return { tabs, active, open, activate, close, reset }
}
