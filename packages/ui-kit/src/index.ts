// @hikari/ui-kit — barrel export public API (fork từ DMCL @dmcl/ui-kit, xem packages/README.md)
// FE import: import { BaseButton, StatusBadge, AppShell, useTabs } from '@hikari/ui-kit'
// CSS: import '@hikari/design-tokens/tokens.css' (một lần ở entry của app)

// Base primitives
export { default as BaseButton } from './components/BaseButton.vue'
export { default as BaseBadge } from './components/BaseBadge.vue'
export { default as BasePanel } from './components/BasePanel.vue'
export { default as BaseModal } from './components/BaseModal.vue'
export { default as StatCard } from './components/StatCard.vue'
export { default as Toolbar } from './components/Toolbar.vue'
export { default as Timeline } from './components/Timeline.vue'
export { default as EmptyState } from './components/EmptyState.vue'
export { default as Skeleton } from './components/Skeleton.vue'
export { default as ErrorState } from './components/ErrorState.vue'
export { default as Tabs } from './components/Tabs.vue'
export { default as FilterableCheckboxList } from './components/FilterableCheckboxList.vue'
export { default as BaseCombobox } from './components/BaseCombobox.vue'
export { default as FormField } from './components/FormField.vue'
export { default as FormSection } from './components/FormSection.vue'

// Domain-aware
export { default as StatusBadge } from './components/StatusBadge.vue'

// Layout
export { default as AppShell } from './components/AppShell.vue'
export { default as TabBar } from './components/TabBar.vue'
export { default as DebugConsole } from './components/DebugConsole.vue'

// Meta & helpers
export * from './meta/status-meta'
export { useTabs } from './composables/useTabs'
export type { TabItem } from './composables/useTabs'

// HTTP client
export { createApi } from './api'
export type { Api, ApiError, ApiTrace, CreateApiOptions, ListMeta } from './api'
