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

const layout = computed(() =>
  props.components.map((c) => ({
    i: c.i || c.id,
    x: c.layout.x,
    y: c.layout.y,
    w: c.layout.w,
    h: c.layout.h,
  })),
);

function getComponent(id: string) {
  return props.components.find((c) => (c.i || c.id) === id);
}

function onLayoutUpdated(newLayout: any[]) {
  emit('layout-updated', newLayout);
}
</script>

<style>
.grid-item-wrapper {
  overflow: hidden;
}
</style>
