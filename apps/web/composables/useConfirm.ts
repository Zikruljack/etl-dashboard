import type { Ref } from 'vue';

/**
 * State managed by the useConfirm composable.
 * Bind these to a ConfirmDialog component.
 */
interface UseConfirmReturn {
  /** Whether the confirm dialog is currently open */
  isOpen: Ref<boolean>;
  /** Dialog title text */
  title: Ref<string>;
  /** Dialog message/description text */
  message: Ref<string>;
  /** Variant for styling (danger = red confirm button, warning = yellow) */
  variant: Ref<'danger' | 'warning' | 'info'>;
  /**
   * Show a confirmation dialog and wait for user response.
   * Returns true if confirmed, false if cancelled.
   *
   * @param options - Dialog configuration
   * @returns Promise that resolves to true (confirmed) or false (cancelled)
   */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Handle confirm action — call from ConfirmDialog's confirm button */
  handleConfirm: () => void;
  /** Handle cancel action — call from ConfirmDialog's cancel button */
  handleCancel: () => void;
}

/**
 * Options for showing a confirmation dialog.
 */
interface ConfirmOptions {
  /** Dialog title */
  title?: string;
  /** Dialog message/description */
  message: string;
  /** Visual variant — affects confirm button color (default: 'danger') */
  variant?: 'danger' | 'warning' | 'info';
}

/**
 * Composable for managing confirmation dialog state.
 * Replaces vanilla confirm() with a Promise-based dialog.
 *
 * @returns Reactive state for the dialog and a confirm() function
 *
 * @example
 * ```vue
 * <script setup>
 * const { isOpen, title, message, variant, confirm, handleConfirm, handleCancel } = useConfirm();
 *
 * async function deleteItem() {
 *   const ok = await confirm({ message: 'Delete this item?', title: 'Confirm Delete' });
 *   if (ok) { // proceed with delete }
 * }
 * </script>
 *
 * <template>
 *   <ConfirmDialog
 *     :open="isOpen" :title="title" :message="message" :variant="variant"
 *     @confirm="handleConfirm" @cancel="handleCancel"
 *   />
 * </template>
 * ```
 */
export function useConfirm(): UseConfirmReturn {
  const isOpen = ref(false);
  const title = ref('');
  const message = ref('');
  const variant = ref<'danger' | 'warning' | 'info'>('danger');

  let resolvePromise: ((value: boolean) => void) | null = null;

  /**
   * Show a confirmation dialog and wait for user response.
   *
   * @param options - Dialog configuration
   * @returns Promise resolving to true (confirmed) or false (cancelled)
   */
  function confirm(options: ConfirmOptions): Promise<boolean> {
    title.value = options.title || 'Confirm';
    message.value = options.message;
    variant.value = options.variant || 'danger';
    isOpen.value = true;

    return new Promise<boolean>((resolve) => {
      resolvePromise = resolve;
    });
  }

  /**
   * Handle confirm button click — resolves the promise with true.
   */
  function handleConfirm() {
    isOpen.value = false;
    resolvePromise?.(true);
    resolvePromise = null;
  }

  /**
   * Handle cancel button click — resolves the promise with false.
   */
  function handleCancel() {
    isOpen.value = false;
    resolvePromise?.(false);
    resolvePromise = null;
  }

  return {
    isOpen,
    title,
    message,
    variant,
    confirm,
    handleConfirm,
    handleCancel,
  };
}
