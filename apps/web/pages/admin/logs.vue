<template>
  <div>
    <PageHeader title="Activity Logs" description="Track user actions and system events">
      <template #actions>
        <select
          v-model="filter"
          class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="all">All Activities</option>
          <option value="auth">Authentication</option>
          <option value="dataset">Datasets</option>
          <option value="dashboard">Dashboards</option>
        </select>
      </template>
    </PageHeader>

    <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <EmptyState
        v-if="logs.length === 0"
        title="No activity logs yet"
        message="Activity logging will be recorded as users interact with the system. This feature is coming in a future update."
        icon="📋"
      />
      <table v-else class="w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Time</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Action</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Details</th>
          </tr>
        </thead>
        <tbody>
            <tr v-for="log in filteredLogs" :key="log.id" class="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{{ log.time }}</td>
            <td class="px-4 py-3 font-medium dark:text-gray-200">{{ log.user }}</td>
            <td class="px-4 py-3">
              <StatusBadge :status="log.category" :label="log.action" />
            </td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{{ log.details }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'admin' });

const filter = ref('all');

// Placeholder - will be populated from backend API when activity_logs table is added
const logs = ref<Array<{
  id: string;
  time: string;
  user: string;
  action: string;
  category: string;
  details: string;
}>>([]);

const filteredLogs = computed(() => {
  if (filter.value === 'all') return logs.value;
  return logs.value.filter((l) => l.category === filter.value);
});
</script>
