<template>
  <div>
    <PageHeader title="System Info" description="Server status, database stats, and application info">
      <template #actions>
        <button @click="refresh" :disabled="loading" class="btn-primary">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
      </template>
    </PageHeader>

    <LoadingState v-if="loading && !sysInfo" message="Loading system info..." />

    <template v-else-if="sysInfo">
      <!-- Top stat cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div
          v-for="(label, key) in topStats"
          :key="key"
          class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
        >
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ label }}</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {{ sysInfo.database.tableCounts[key] ?? '—' }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Server details -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-base font-semibold dark:text-gray-100 mb-4">Server</h2>
          <div class="space-y-2 text-sm">
            <div v-for="row in serverRows" :key="row.label" class="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span class="text-gray-500 dark:text-gray-400">{{ row.label }}</span>
              <span class="font-mono text-gray-700 dark:text-gray-300 text-xs">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <!-- DB table sizes -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold dark:text-gray-100">Database Tables</h2>
            <span class="text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
              Total: {{ formatBytes(sysInfo.database.totalSizeBytes) }}
            </span>
          </div>
          <!-- Size bar chart per table -->
          <div class="space-y-2">
            <div
              v-for="(count, table) in sysInfo.database.tableCounts"
              :key="table"
            >
              <div class="flex items-center justify-between text-xs mb-0.5">
                <span class="font-mono text-gray-500 dark:text-gray-400">{{ table }}</span>
                <div class="flex items-center gap-3">
                  <span class="text-gray-400 dark:text-gray-500">{{ count.toLocaleString() }} rows</span>
                  <span class="font-semibold text-gray-700 dark:text-gray-300 w-16 text-right">
                    {{ formatBytes(sysInfo.database.tableSizes[table]?.totalBytes ?? 0) }}
                  </span>
                </div>
              </div>
              <div class="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500"
                  :style="{ width: tableSizePercent(table) + '%' }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'admin' });

const { $api } = useApi();

interface TableSizeInfo {
  totalBytes: number;
  tableBytes: number;
  indexBytes: number;
}

interface SysInfo {
  server: {
    nodeVersion: string;
    platform: string;
    arch: string;
    uptimeSeconds: number;
    memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number };
    cpus: number;
    hostname: string;
  };
  database: {
    tableCounts: Record<string, number>;
    totalSizeBytes: number;
    tableSizes: Record<string, TableSizeInfo>;
  };
  app: { version: string; env: string };
}

const sysInfo = ref<SysInfo | null>(null);
const loading = ref(false);

const topStats: Record<string, string> = {
  users: 'Users',
  datasets: 'Datasets',
  dashboards: 'Dashboards',
  dataset_rows: 'Data Rows',
  activity_logs: 'Log Entries',
};

const serverRows = computed(() => {
  if (!sysInfo.value) return [];
  const s = sysInfo.value.server;
  const uptimeH = Math.floor(s.uptimeSeconds / 3600);
  const uptimeM = Math.floor((s.uptimeSeconds % 3600) / 60);
  return [
    { label: 'Status', value: '● Online' },
    { label: 'Node.js', value: s.nodeVersion },
    { label: 'Platform', value: `${s.platform} (${s.arch})` },
    { label: 'Hostname', value: s.hostname },
    { label: 'CPUs', value: String(s.cpus) },
    { label: 'Uptime', value: `${uptimeH}h ${uptimeM}m` },
    { label: 'Heap Used', value: `${s.memory.heapUsedMb} MB / ${s.memory.heapTotalMb} MB` },
    { label: 'RSS', value: `${s.memory.rssMb} MB` },
    { label: 'App Version', value: sysInfo.value.app.version },
    { label: 'Environment', value: sysInfo.value.app.env },
  ];
});

/** Format bytes to human-readable string (KB / MB / GB). */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Returns width percentage of a table's size relative to the largest table. */
function tableSizePercent(table: string): number {
  if (!sysInfo.value) return 0;
  const sizes = sysInfo.value.database.tableSizes;
  const maxBytes = Math.max(...Object.values(sizes).map((s) => s.totalBytes), 1);
  return Math.round(((sizes[table]?.totalBytes ?? 0) / maxBytes) * 100);
}

onMounted(() => refresh());

async function refresh() {
  loading.value = true;
  try {
    const res = await $api<{ success: boolean; data: SysInfo }>('/admin/system');
    sysInfo.value = res.data ?? null;
  } catch (e) {
    console.error('Failed to load system info', e);
  } finally {
    loading.value = false;
  }
}
</script>
