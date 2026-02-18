<template>
  <div class="h-full">
    <div v-if="loading" class="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
    <div v-else-if="!datasetId" class="flex items-center justify-center h-full text-gray-400 text-sm">
      Select a dataset
    </div>
    <div v-else-if="!config?.latitudeColumn || !config?.longitudeColumn" class="flex items-center justify-center h-full text-gray-400 text-sm">
      Configure latitude and longitude columns
    </div>
    <client-only v-else>
      <l-map
        ref="mapRef"
        :zoom="mapZoom"
        :center="mapCenter"
        class="h-full w-full rounded"
        :use-global-leaflet="false"
      >
        <l-tile-layer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <l-marker
          v-for="(point, idx) in points"
          :key="idx"
          :lat-lng="point.latLng"
        >
          <l-popup>
            <div class="text-xs">
              <strong>{{ point.label }}</strong>
              <div v-for="(val, key) in point.details" :key="key" class="mt-0.5">
                <span class="text-gray-500">{{ key }}:</span> {{ val }}
              </div>
            </div>
          </l-popup>
        </l-marker>
      </l-map>
    </client-only>
  </div>
</template>

<script setup lang="ts">
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet';

const props = defineProps<{
  config: any;
  datasetId: string | null;
}>();

const { $api } = useApi();

const data = ref<Record<string, unknown>[]>([]);
const loading = ref(false);

// Default center: Aceh, Indonesia
const mapCenter = computed<[number, number]>(() => {
  if (props.config?.center) return props.config.center;
  if (points.value.length > 0) {
    const avgLat = points.value.reduce((s, p) => s + p.latLng[0], 0) / points.value.length;
    const avgLng = points.value.reduce((s, p) => s + p.latLng[1], 0) / points.value.length;
    return [avgLat, avgLng];
  }
  return [4.695, 96.749]; // Aceh default
});

const mapZoom = computed(() => props.config?.zoom || 8);

const points = computed(() => {
  return data.value
    .map((row) => {
      const lat = Number(row[props.config.latitudeColumn]);
      const lng = Number(row[props.config.longitudeColumn]);
      if (isNaN(lat) || isNaN(lng)) return null;

      const label = props.config.labelColumn ? String(row[props.config.labelColumn] ?? '') : `${lat}, ${lng}`;
      const details: Record<string, unknown> = {};
      if (props.config.popupColumns) {
        props.config.popupColumns.forEach((col: string) => {
          details[col] = row[col];
        });
      }

      return { latLng: [lat, lng] as [number, number], label, details };
    })
    .filter(Boolean) as Array<{ latLng: [number, number]; label: string; details: Record<string, unknown> }>;
});

watch(() => [props.datasetId, props.config?.latitudeColumn, props.config?.longitudeColumn], () => loadData(), { immediate: true });

async function loadData() {
  if (!props.datasetId || !props.config?.latitudeColumn || !props.config?.longitudeColumn) return;
  loading.value = true;
  try {
    const res = await $api<any>('/data/query', {
      method: 'POST',
      body: {
        datasetId: props.datasetId,
        limit: 5000,
      },
    });
    data.value = res.data.data;
  } catch (e) {
    console.error('Widget map load failed', e);
  } finally {
    loading.value = false;
  }
}
</script>
