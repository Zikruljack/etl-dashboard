<!--
  SkeletonLoader — Animated placeholder for loading content.
  Use instead of or alongside LoadingState for a more modern UX.

  @prop variant - Shape variant: 'text' (default), 'circle', 'card', 'table'
  @prop lines - Number of text lines (only for variant='text')
  @prop height - Custom height class (e.g. 'h-40')
-->
<template>
  <!-- Table skeleton -->
  <div v-if="variant === 'table'" class="card overflow-hidden animate-pulse">
    <div class="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <div class="flex gap-4">
        <div v-for="n in 4" :key="n" class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full flex-1" />
      </div>
    </div>
    <div class="divide-y divide-gray-100 dark:divide-gray-800">
      <div v-for="row in rows" :key="row" class="px-4 py-3 flex gap-4">
        <div v-for="n in 4" :key="n" class="h-3 bg-gray-100 dark:bg-gray-800 rounded-full flex-1"
          :class="{ 'max-w-[60%]': n === 4 }" />
      </div>
    </div>
  </div>

  <!-- Card skeleton -->
  <div v-else-if="variant === 'card'" class="card p-5 animate-pulse" :class="height">
    <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-1/3 mb-3" />
    <div class="h-3 bg-gray-100 dark:bg-gray-800 rounded-full w-2/3 mb-2" />
    <div class="h-3 bg-gray-100 dark:bg-gray-800 rounded-full w-1/2" />
  </div>

  <!-- Circle skeleton (avatar) -->
  <div v-else-if="variant === 'circle'" class="animate-pulse">
    <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
  </div>

  <!-- Text lines skeleton (default) -->
  <div v-else class="animate-pulse space-y-2">
    <div
      v-for="(n, i) in computedLines"
      :key="i"
      class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full"
      :class="i === computedLines - 1 ? 'w-2/3' : 'w-full'"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * SkeletonLoader component props.
 */
const props = withDefaults(defineProps<{
  /** Shape variant */
  variant?: 'text' | 'circle' | 'card' | 'table';
  /** Number of text lines (variant='text') */
  lines?: number;
  /** Number of table rows (variant='table') */
  rows?: number;
  /** Custom height class */
  height?: string;
}>(), {
  variant: 'text',
  lines: 3,
  rows: 5,
  height: '',
});

const computedLines = computed(() => props.lines);
</script>
