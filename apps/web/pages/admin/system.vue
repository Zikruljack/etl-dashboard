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

        <!-- DB table counts -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-base font-semibold dark:text-gray-100 mb-4">Database Tables</h2>
          <div class="space-y-1.5">
            <div
              v-for="(count, table) in sysInfo.database.tableCounts"
              :key="table"
              class="flex items-center justify-between text-sm"
            >
              <span class="font-mono text-gray-500 dark:text-gray-400 text-xs">{{ table }}</span>
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ count.toLocaleString() }}</span>
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
  database: { tableCounts: Record<string, number> };
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
