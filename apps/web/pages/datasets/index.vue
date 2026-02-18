<template>
  <div>
    <PageHeader title="Datasets" description="Manage your data sources and extracted datasets">
      <template #actions>
        <NuxtLink
          v-if="authStore.isEditor"
          to="/datasets/new"
          class="btn-primary"
        >
          <span class="text-lg leading-none">+</span> New Dataset
        </NuxtLink>
      </template>
    </PageHeader>

    <!-- Skeleton loading -->
    <template v-if="loading">
      <div class="space-y-3">
        <SkeletonLoader v-for="n in 4" :key="n" variant="card" />
      </div>
    </template>

    <EmptyState
      v-else-if="filteredDatasets.length === 0 && !searchQuery"
      title="No datasets yet"
      message="Create your first dataset to start importing and cleaning data"
      icon="📊"
    >
      <NuxtLink
        v-if="authStore.isEditor"
        to="/datasets/new"
        class="mt-2 inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium"
      >
        Create your first dataset &rarr;
      </NuxtLink>
    </EmptyState>

    <template v-else>
      <!-- Search bar -->
      <div v-if="datasets.length > 0" class="mb-4">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search datasets..."
            class="form-input pl-9 max-w-sm"
          />
        </div>
      </div>

      <EmptyState
        v-if="filteredDatasets.length === 0 && searchQuery"
        title="No results"
        :message="`No datasets matching '${searchQuery}'`"
        icon="🔍"
      />

      <div v-else class="space-y-3">
        <NuxtLink
          v-for="ds in filteredDatasets"
          :key="ds.id"
          :to="`/datasets/${ds.id}`"
          class="block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all group"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{{ ds.name }}</h3>
                <StatusBadge :status="ds.syncStatus" />
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ ds.description || 'No description' }}</p>
            </div>
          </div>
          <div class="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span class="inline-flex items-center gap-1">
              {{ ds.sourceType === 'google_sheets' ? '📊' : '📄' }}
              {{ ds.sourceType === 'google_sheets' ? 'Google Sheets' : ds.sourceType }}
            </span>
            <span>{{ ds.columns?.length || 0 }} columns</span>
            <span v-if="ds.lastSyncedAt">
              Synced {{ formatTimeAgo(ds.lastSyncedAt) }}
            </span>
            <span v-else class="text-gray-300">Never synced</span>
          </div>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ApiResponse, Dataset } from '@etl-dashboard/shared';

definePageMeta({ middleware: 'auth' });

const authStore = useAuthStore();
const { $api } = useApi();

const { loading, data: datasets } = useLoading(
  () => $api<ApiResponse<Dataset[]>>('/datasets').then((r) => r.data),
  { immediate: true },
);

/** Search query for filtering datasets */
const searchQuery = ref('');

/** Filtered datasets based on search query */
const filteredDatasets = computed(() => {
  if (!datasets.value) return [];
  if (!searchQuery.value) return datasets.value;
  const q = searchQuery.value.toLowerCase();
  return datasets.value.filter(
    (ds) => ds.name.toLowerCase().includes(q) || ds.description?.toLowerCase().includes(q),
  );
});

/**
 * Format a date string as a relative time ago string.
 */
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
</script>
