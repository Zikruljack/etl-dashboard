<template>
  <div>
    <PageHeader title="System Info" description="Server status, database stats, and application info">
      <template #actions>
        <button
          @click="refresh"
          class="btn-primary"
        >
          Refresh
        </button>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Server Status</p>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full animate-pulse" :class="serverOnline ? 'bg-green-500' : 'bg-red-500'"></span>
          <span class="text-lg font-semibold">{{ serverOnline ? 'Online' : 'Offline' }}</span>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Users</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ stats.users }}</p>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Datasets</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ stats.datasets }}</p>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Dashboards</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ stats.dashboards }}</p>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Data Rows</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ stats.dataRows }}</p>
      </div>
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">App Version</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">0.1.0</p>
      </div>
    </div>

    <!-- Server Info -->
    <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h2 class="text-lg font-semibold dark:text-gray-100 mb-4">Server Details</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span class="text-gray-500 dark:text-gray-400">API Base</span>
          <span class="font-mono text-gray-700 dark:text-gray-300 text-xs">{{ apiBase }}</span>
        </div>
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span class="text-gray-500 dark:text-gray-400">Server Time</span>
          <span class="font-mono text-gray-700 dark:text-gray-300 text-xs">{{ serverTime }}</span>
        </div>
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span class="text-gray-500 dark:text-gray-400">Database</span>
          <span class="font-mono text-gray-700 dark:text-gray-300 text-xs">PostgreSQL</span>
        </div>
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span class="text-gray-500 dark:text-gray-400">Backend</span>
          <span class="font-mono text-gray-700 dark:text-gray-300 text-xs">Express + TypeScript</span>
        </div>
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span class="text-gray-500 dark:text-gray-400">Frontend</span>
          <span class="font-mono text-gray-700 dark:text-gray-300 text-xs">Nuxt 3</span>
        </div>
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <span class="text-gray-500 dark:text-gray-400">ORM</span>
          <span class="font-mono text-gray-700 dark:text-gray-300 text-xs">Drizzle</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'admin' });

const config = useRuntimeConfig();
const { $api } = useApi();

const apiBase = config.public.apiBase;
const serverOnline = ref(false);
const serverTime = ref('');
const stats = reactive({
  users: 0,
  datasets: 0,
  dashboards: 0,
  dataRows: 0,
});

onMounted(() => refresh());

async function refresh() {
  // Check server health
  try {
    const health = await $api<{ status: string; timestamp: string }>('/health');
    serverOnline.value = health.status === 'ok';
    serverTime.value = new Date(health.timestamp).toLocaleString();
  } catch {
    serverOnline.value = false;
    serverTime.value = 'N/A';
  }

  // Get stats
  try {
    const [usersRes, datasetsRes, dashboardRes] = await Promise.all([
      $api<{ success: boolean; data: any[] }>('/users'),
      $api<{ success: boolean; data: any[] }>('/datasets'),
      $api<{ success: boolean; data: any[] }>('/dashboard'),
    ]);
    stats.users = usersRes.data.length;
    stats.datasets = datasetsRes.data.length;
    stats.dashboards = dashboardRes.data.length;
  } catch (e) {
    console.error('Failed to load stats', e);
  }
}
</script>
