<template>
  <div class="dashboard-grid">
    <div v-if="editable && components.length === 0" class="text-center py-16 border-2 border-dashed border-gray-300 rounded-xl">
      <p class="text-gray-400 text-lg mb-2">No widgets yet</p>
      <p class="text-gray-400 text-sm">Click "Add Widget" to get started</p>
    </div>

    <grid-layout
      v-else-if="components.length > 0"
      :layout="layout"
      :col-num="12"
      :row-height="60"
      :is-draggable="editable"
      :is-resizable="editable"
      :margin="[12, 12]"
      :use-css-transforms="true"
      @layout-updated="onLayoutUpdated"
    >
      <grid-item
        v-for="item in layout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
        :is-draggable="editable"
        :is-resizable="editable"
        class="grid-item-wrapper"
      >
        <ComponentWrapper
          :component="getComponent(item.i)"
          :editable="editable"
          @select="$emit('select', item.i)"
          @remove="$emit('remove', item.i)"
        />
      </grid-item>
    </grid-layout>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  components: any[];
  editable: boolean;
}>();

const emit = defineEmits<{
  'layout-updated': [layouts: any[]];
  'select': [id: string];
  'remove': [id: string];
}>();

// Use shallowRef to prevent deep reactivity that causes infinite loops with vue-grid-layout
const layout = shallowRef<any[]>([]);

// Track previous layout to avoid unnecessary updates
let previousLayoutKey = '';

// Watch for changes in components and update layout
watch(
  () => props.components,
  (newComponents) => {
    const newLayout = newComponents
      .filter((c) => c?.layout && (c.i || c.id))
      .map((c) => ({
        i: c.i || c.id,
        x: c.layout.x,
        y: c.layout.y,
        w: c.layout.w,
        h: c.layout.h,
      }));
    
    // Create a key to detect actual changes
    const newKey = newLayout.map((l) => `${l.i}:${l.x}:${l.y}:${l.w}:${l.h}`).join('|');
    
    // Only update if layout actually changed
    if (newKey !== previousLayoutKey) {
      previousLayoutKey = newKey;
      layout.value = newLayout;
    }
  },
  { immediate: true },
);

function getComponent(id: string) {
  return props.components.find((c) => (c.i || c.id) === id);
}

function onLayoutUpdated(newLayout: any[]) {
  const normalizedLayout = newLayout
    .filter((l) => l?.i)
    .map((l) => ({ ...l }));

  // Only update previousLayoutKey (so watcher skips this change) — do NOT reassign layout.value
  // here as that would re-trigger vue-grid-layout causing infinite recursion.
  previousLayoutKey = normalizedLayout.map((l) => `${l.i}:${l.x}:${l.y}:${l.w}:${l.h}`).join('|');
  emit('layout-updated', normalizedLayout);
}
</script>

<style>
.grid-item-wrapper {
  overflow: hidden;
}
</style>
