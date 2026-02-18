/**
 * Color mode composable — manages light/dark theme preference.
 * Persists selection in localStorage and applies 'dark' class to <html>.
 * Defaults to system preference on first visit.
 *
 * @example
 * const { colorMode, toggleColorMode, isDark } = useColorMode();
 * toggleColorMode(); // switches between light and dark
 */

type ColorMode = 'light' | 'dark' | 'system';

/** Global state — shared across all component instances */
const colorMode = ref<ColorMode>('system');
const STORAGE_KEY = 'etl-color-mode';

/**
 * Resolve the effective mode (light or dark) based on current setting.
 *
 * @param mode - The stored preference
 * @returns Resolved effective mode
 */
function resolveMode(mode: ColorMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

/**
 * Apply the resolved color mode to <html> element.
 *
 * @param mode - The color mode preference to apply
 */
function applyMode(mode: ColorMode) {
  if (typeof document === 'undefined') return;
  const resolved = resolveMode(mode);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

/**
 * useColorMode — reactive dark/light mode composable.
 *
 * @returns Color mode state and control methods
 */
export function useColorMode() {
  /** Whether the effective mode is currently dark */
  const isDark = computed(() => resolveMode(colorMode.value) === 'dark');

  /**
   * Set the color mode preference.
   *
   * @param mode - The mode to set: 'light', 'dark', or 'system'
   */
  function setColorMode(mode: ColorMode) {
    colorMode.value = mode;
    localStorage.setItem(STORAGE_KEY, mode);
    applyMode(mode);
  }

  /** Toggle between light and dark (bypasses system). */
  function toggleColorMode() {
    setColorMode(isDark.value ? 'light' : 'dark');
  }

  // Initialize on first call (client-side only)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY) as ColorMode | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      colorMode.value = stored;
    }
    applyMode(colorMode.value);

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (colorMode.value === 'system') {
        applyMode('system');
      }
    });
  }

  return {
    /** Current color mode preference */
    colorMode: readonly(colorMode),
    /** Whether the effective mode is dark */
    isDark,
    /** Set a specific color mode */
    setColorMode,
    /** Toggle between light and dark */
    toggleColorMode,
  };
}
