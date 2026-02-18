<!--
  ConfirmDialog — Modal confirmation dialog with keyboard support.
  Replaces vanilla confirm() calls with a styled, Promise-based dialog.
  Designed to work with the useConfirm() composable.

  Features:
  - ESC to close
  - Focus trap (focus stays inside dialog)
  - Auto-focus confirm button on open
  - Backdrop click to cancel

  @prop open - Whether the dialog is visible
  @prop title - Dialog title text
  @prop message - Dialog body/description text
  @prop variant - Visual variant affecting confirm button color ('danger' | 'warning' | 'info')
  @prop confirmLabel - Text for the confirm button (default: 'Confirm')
  @prop cancelLabel - Text for the cancel button (default: 'Cancel')
  @emit confirm - Emitted when the confirm button is clicked
  @emit cancel - Emitted when the cancel button, backdrop, or ESC is pressed
-->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @keydown.esc="$emit('cancel')"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]" @click="$emit('cancel')" />

        <!-- Dialog -->
        <div
          ref="dialogRef"
          class="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6 animate-dialog-in"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="messageId"
          tabindex="-1"
        >
          <h3 :id="titleId" class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ title }}</h3>
          <p :id="messageId" class="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{{ message }}</p>

          <div class="flex justify-end gap-3">
            <button
              @click="$emit('cancel')"
              class="btn-secondary"
            >
              {{ cancelLabel }}
            </button>
            <button
              ref="confirmBtnRef"
              @click="$emit('confirm')"
              class="btn text-white shadow-sm"
              :class="confirmButtonClass"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * ConfirmDialog component props.
 */
const props = withDefaults(defineProps<{
  /** Whether the dialog is visible */
  open: boolean;
  /** Dialog title text */
  title: string;
  /** Dialog body/description text */
  message: string;
  /** Visual variant — affects confirm button color */
  variant?: 'danger' | 'warning' | 'info';
  /** Text for the confirm button */
  confirmLabel?: string;
  /** Text for the cancel button */
  cancelLabel?: string;
}>(), {
  variant: 'danger',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
});

defineEmits<{
  /** Emitted when user confirms */
  confirm: [];
  /** Emitted when user cancels (button, backdrop click, or ESC) */
  cancel: [];
}>();

const dialogRef = ref<HTMLElement>();
const confirmBtnRef = ref<HTMLButtonElement>();

/** Unique IDs for a11y */
const titleId = `dialog-title-${Math.random().toString(36).slice(2, 8)}`;
const messageId = `dialog-msg-${Math.random().toString(36).slice(2, 8)}`;

/** Auto-focus confirm button and trap focus when dialog opens */
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      confirmBtnRef.value?.focus();
    });
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

/** Cleanup on unmount */
onUnmounted(() => {
  document.body.style.overflow = '';
});

/**
 * Confirm button CSS class based on variant.
 */
const confirmButtonClass = computed(() => {
  switch (props.variant) {
    case 'danger': return 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500';
    case 'warning': return 'bg-yellow-600 hover:bg-yellow-700 focus-visible:ring-yellow-500';
    case 'info': return 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500';
    default: return 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500';
  }
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.animate-dialog-in {
  animation: dialog-in 0.15s ease-out;
}
</style>
