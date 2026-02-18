<!--
  EmptyState — Centered placeholder for empty lists/tables.
  Replaces inline "No X yet" text patterns used across pages.

  @prop title - Main heading text (e.g. "No datasets yet")
  @prop message - Optional secondary description text
  @prop icon - Optional emoji or icon character (default: '📭')
  @prop actionLabel - Optional action button text
  @emit action - Emitted when the action button is clicked
  @slot default - Optional custom content below the message
  @slot actions - Optional custom action buttons
-->
<template>
  <div class="flex flex-col items-center justify-center py-12">
    <span class="text-4xl mb-3">{{ icon }}</span>
    <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">{{ title }}</h3>
    <p v-if="message" class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ message }}</p>
    <slot />
    <slot name="actions">
      <button
        v-if="actionLabel"
        @click="$emit('action')"
        class="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
      >
        {{ actionLabel }}
      </button>
    </slot>
  </div>
</template>

<script setup lang="ts">
/**
 * EmptyState component props.
 */
withDefaults(defineProps<{
  /** Main heading text */
  title: string;
  /** Optional secondary description */
  message?: string;
  /** Emoji or icon character */
  icon?: string;
  /** Optional action button label */
  actionLabel?: string;
}>(), {
  icon: '📭',
});

defineEmits<{
  /** Emitted when the action button is clicked */
  action: [];
}>();
</script>
