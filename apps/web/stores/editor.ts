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
      };

      this.components.push({
        id,
        type,
        title: `New ${type}`,
        layout: { x: 0, y: 0, w: 6, h: 4 },
        config: defaultConfigs[type],
        datasetId: null,
        i: id,
      });
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
      layouts.forEach((l) => {
        const comp = this.components.find((c) => c.i === l.i);
        if (comp) {
          comp.layout = { x: l.x, y: l.y, w: l.w, h: l.h };
        }
      });
      this.isDirty = true;
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
