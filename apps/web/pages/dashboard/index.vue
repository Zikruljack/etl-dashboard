<template>
  <div>
    <PageHeader title="Dashboards" description="Create and manage data visualizations">
      <template #actions>
        <NuxtLink
          v-if="authStore.isEditor"
          to="/dashboard/new"
          class="btn-primary"
        >
          <span class="text-lg leading-none">+</span> New Dashboard
        </NuxtLink>
      </template>
    </PageHeader>

    <!-- Skeleton loading -->
    <template v-if="loading">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonLoader v-for="n in 6" :key="n" variant="card" />
      </div>
    </template>

    <EmptyState
      v-else-if="filteredDashboards.length === 0 && !searchQuery"
      title="No dashboards yet"
      message="Create your first dashboard to visualize data"
      icon="📊"
    >
      <NuxtLink
        v-if="authStore.isEditor"
        to="/dashboard/new"
        class="mt-2 inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium"
      >
        Create your first dashboard &rarr;
      </NuxtLink>
    </EmptyState>

    <template v-else>
      <!-- Search -->
      <div v-if="dashboard && dashboard.length > 0" class="mb-4">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input v-model="searchQuery" type="search" placeholder="Search dashboards..." class="form-input pl-9 max-w-sm" />
        </div>
      </div>

      <EmptyState
        v-if="filteredDashboards.length === 0 && searchQuery"
        title="No results"
        :message="`No dashboards matching '${searchQuery}'`"
        icon="🔍"
      />

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink
          v-for="d in filteredDashboards"
          :key="d.id"
        :to="`/dashboard/${d.id}`"
        class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all group"
      >
        <div class="flex items-start justify-between mb-2">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{{ d.title }}</h3>
          <StatusBadge v-if="d.isPublished" status="published" label="Published" />
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{{ d.description || 'No description' }}</p>
        <div class="flex items-center justify-between text-xs text-gray-400">
          <span>{{ d.pages?.length || 0 }} pages</span>
          <span>{{ new Date(d.createdAt).toLocaleDateString() }}</span>
        </div>
      </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ApiResponse, Dashboard } from '@etl-dashboard/shared';

definePageMeta({ middleware: 'auth' });

const authStore = useAuthStore();
const { $api } = useApi();

const { loading, data: dashboard } = useLoading(
  () => $api<ApiResponse<Dashboard[]>>('/dashboard').then((r) => r.data),
  { immediate: true },
);

const searchQuery = ref('');

const filteredDashboards = computed(() => {
  if (!dashboard.value) return [];
  if (!searchQuery.value) return dashboard.value;
  const q = searchQuery.value.toLowerCase();
  return dashboard.value.filter(
    (d) => d.title.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q),
  );
});
</script>
