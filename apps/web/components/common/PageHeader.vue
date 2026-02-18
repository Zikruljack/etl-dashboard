<!--
  PageHeader — Consistent page title bar with optional action buttons.
  Replaces the duplicated flex/justify-between/h1 pattern across all pages.

  @prop title - Page heading text
  @prop description - Optional subtext below the title
  @prop backTo - Optional back navigation link (shows ← arrow)
  @slot actions - Right-side action buttons (e.g. "New", "Save")
  @slot badge - Optional badge/status next to the title
-->
<template>
  <div class="flex items-center justify-between mb-6">
    <div>
      <div class="flex items-center gap-2">
        <NuxtLink v-if="backTo" :to="backTo" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          &larr;
        </NuxtLink>
        <h1 class="text-2xl font-bold dark:text-gray-100">{{ title }}</h1>
        <slot name="badge" />
      </div>
      <p v-if="description" class="text-gray-500 dark:text-gray-400 mt-1">{{ description }}</p>
    </div>
    <div class="flex gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PageHeader component props.
 */
defineProps<{
  /** Page heading text */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Optional back navigation route */
  backTo?: string;
}>();
</script>
