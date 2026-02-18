<template>
  <div>
    <PageHeader title="Activity Logs" description="Track user actions and system events">
      <template #actions>
        <div class="flex gap-2 flex-wrap">
          <select
            v-model="filters.resourceType"
            @change="reload"
            class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All Resources</option>
            <option value="auth">Auth</option>
            <option value="dataset">Dataset</option>
            <option value="dashboard">Dashboard</option>
            <option value="pipeline">Pipeline</option>
            <option value="user">User</option>
          </select>
          <input
            v-model="filters.dateFrom"
            type="date"
            @change="reload"
            class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-200"
          />
          <button @click="clearFilters" class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2">
            Clear
          </button>
        </div>
      </template>
    </PageHeader>

    <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <LoadingState v-if="loading" message="Loading logs..." />
      <EmptyState
        v-else-if="!logs.length"
        title="No activity logs yet"
        message="Logs will appear as users interact with the system — create datasets, sync, login, and more."
        icon="📋"
      />
      <table v-else class="w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Time</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Action</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Resource</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Details</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="log in logs"
            :key="log.id"
            class="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <td class="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
              {{ new Date(log.createdAt).toLocaleString() }}
            </td>
            <td class="px-4 py-3">
              <div v-if="log.userName" class="font-medium text-gray-900 dark:text-gray-100 text-xs">{{ log.userName }}</div>
              <div v-if="log.userEmail" class="text-gray-400 text-xs">{{ log.userEmail }}</div>
              <span v-if="!log.userName" class="text-gray-400 text-xs italic">System</span>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                :class="actionColorClass(log.action)"
              >
                {{ log.action }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
              <span v-if="log.resourceType" class="capitalize">{{ log.resourceType }}</span>
              <span v-if="log.resourceId" class="text-gray-300 dark:text-gray-600 ml-1 font-mono">
                #{{ log.resourceId.slice(0, 8) }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-400 text-xs font-mono max-w-xs truncate">
              {{ log.details ? JSON.stringify(log.details) : '' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between mt-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Showing {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, total) }} of {{ total }} logs
      </p>
      <div class="flex gap-2">
        <button
          @click="page--; reload()"
          :disabled="page === 1"
          class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Prev
        </button>
        <span class="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">{{ page }} / {{ totalPages }}</span>
        <button
          @click="page++; reload()"
          :disabled="page >= totalPages"
          class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'admin' });

const { $api } = useApi();

const page = ref(1);
const pageSize = 50;
const total = ref(0);
const totalPages = computed(() => Math.ceil(total.value / pageSize));

const filters = reactive({ resourceType: '', dateFrom: '' });
const logs = ref<any[]>([]);
const loading = ref(false);

onMounted(() => reload());

async function reload() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize),
    });
    if (filters.resourceType) params.set('resourceType', filters.resourceType);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);

    const res = await $api<any>(`/admin/logs?${params}`);
    logs.value = res.data;
    total.value = res.pagination?.total ?? 0;
  } catch (e) {
    console.error('Failed to load logs', e);
  } finally {
    loading.value = false;
  }
}

function clearFilters() {
  filters.resourceType = '';
  filters.dateFrom = '';
  page.value = 1;
  reload();
}

/** Map action to badge color class */
function actionColorClass(action: string): string {
  if (action.startsWith('delete_')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (action.startsWith('create_')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (action === 'login' || action === 'register') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  if (action.startsWith('sync_')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}
</script>
