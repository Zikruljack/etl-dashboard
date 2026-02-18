import { defineStore } from 'pinia';
import type { DashboardComponent, GridLayout, ComponentType, WidgetConfig } from '@etl-dashboard/shared';

interface EditorComponent {
  id: string;
  type: ComponentType;
  title: string;
  layout: GridLayout;
  config: WidgetConfig;
  datasetId: string | null;
  i: string; // vue-grid-layout key
}

export const useEditorStore = defineStore('editor', {
  state: () => ({
    components: [] as EditorComponent[],
    selectedComponentId: null as string | null,
    isDirty: false,
  }),

  getters: {
    selectedComponent: (state) => state.components.find((c) => c.id === state.selectedComponentId),
    gridLayout: (state) => state.components.map((c) => ({
      i: c.i,
      x: c.layout.x,
      y: c.layout.y,
      w: c.layout.w,
      h: c.layout.h,
    })),
  },

  actions: {
    loadComponents(components: DashboardComponent[]) {
      this.components = components.map((c) => ({
        id: c.id,
        type: c.type,
        title: c.title || '',
        layout: c.layout,
        config: c.config,
        datasetId: c.datasetId,
        i: c.id,
      }));
      this.isDirty = false;
    },

    addComponent(type: ComponentType) {
      const id = crypto.randomUUID();
      const defaultConfigs: Record<ComponentType, WidgetConfig> = {
        table: { columns: [], pageSize: 10, sortable: true, filterable: true },
        chart: { chartType: 'bar', xAxis: '', yAxis: '' },
        map: { latitudeColumn: '', longitudeColumn: '' },
        timeline: { dateColumn: '', titleColumn: '' },
        kpi: { valueColumn: '', aggregation: 'sum' },
      };

      // Place new widget below all existing widgets to avoid collisions
      const bottomY = this.components.reduce((max, c) => Math.max(max, c.layout.y + c.layout.h), 0);

      // Use array replacement (not push) so the watcher in DashboardGrid detects the new reference
      this.components = [
        ...this.components,
        {
          id,
          type,
          title: `New ${type}`,
          layout: { x: 0, y: bottomY, w: 6, h: 4 },
          config: defaultConfigs[type],
          datasetId: null,
          i: id,
        },
      ];
      this.selectedComponentId = id;
      this.isDirty = true;
    },

    removeComponent(id: string) {
      this.components = this.components.filter((c) => c.id !== id);
      if (this.selectedComponentId === id) {
        this.selectedComponentId = null;
      }
      this.isDirty = true;
    },

    updateLayout(layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) {
      let hasChanged = false;
      const byId = new Map(layouts.map((l) => [l.i, l]));

      // Mutate existing component layout in place so grid items stay stable while dragging/resizing.
      for (const component of this.components) {
        const next = byId.get(component.i);
        if (!next) continue;

        const hasLayoutChanged =
          component.layout.x !== next.x ||
          component.layout.y !== next.y ||
          component.layout.w !== next.w ||
          component.layout.h !== next.h;

        if (!hasLayoutChanged) continue;

        component.layout = {
          x: next.x,
          y: next.y,
          w: next.w,
          h: next.h,
        };
        hasChanged = true;
      }

      if (hasChanged) this.isDirty = true;
    },

    updateComponent(id: string, updates: Partial<EditorComponent>) {
      const comp = this.components.find((c) => c.id === id);
      if (comp) {
        Object.assign(comp, updates);
        this.isDirty = true;
      }
    },

    selectComponent(id: string | null) {
      this.selectedComponentId = id;
    },
  },
});
