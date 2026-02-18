/**
 * Toast notification composable.
 * Provides a global toast queue for success/error/info/warning messages.
 * Auto-dismisses after a configurable duration.
 *
 * @example
 * const toast = useToast();
 * toast.success('Dataset synced successfully');
 * toast.error('Failed to delete dataset');
 */

/** Toast notification item */
export interface ToastItem {
  /** Unique ID */
  id: number;
  /** Toast message text */
  message: string;
  /** Visual variant */
  type: 'success' | 'error' | 'info' | 'warning';
  /** Auto-dismiss duration in ms */
  duration: number;
}

/** Global toast state — shared across all component instances */
const toasts = ref<ToastItem[]>([]);
let nextId = 0;

/**
 * useToast composable — add/remove toast notifications globally.
 *
 * @returns Toast state and methods to show/dismiss toasts
 */
export function useToast() {
  /**
   * Add a toast notification to the queue.
   *
   * @param message - Text to display
   * @param type - Visual variant (success, error, info, warning)
   * @param duration - Auto-dismiss after ms (default: 4000)
   */
  function add(message: string, type: ToastItem['type'] = 'info', duration = 4000) {
    const id = ++nextId;
    toasts.value.push({ id, message, type, duration });

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }

  /**
   * Dismiss a specific toast by ID.
   *
   * @param id - Toast ID to remove
   */
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  /** Show a success toast. */
  function success(message: string, duration?: number) {
    add(message, 'success', duration);
  }

  /** Show an error toast. */
  function error(message: string, duration?: number) {
    add(message, 'error', duration ?? 6000);
  }

  /** Show a warning toast. */
  function warning(message: string, duration?: number) {
    add(message, 'warning', duration);
  }

  /** Show an info toast. */
  function info(message: string, duration?: number) {
    add(message, 'info', duration);
  }

  return {
    toasts: readonly(toasts),
    add,
    dismiss,
    success,
    error,
    warning,
    info,
  };
}
