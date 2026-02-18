<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ dashboard?.title }}</h1>
          <p v-if="dashboard?.description" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {{ dashboard.description }}
          </p>
        </div>
        <NuxtLink to="/login" class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
          Sign in
        </NuxtLink>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-6">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center h-64">
        <LoadingState message="Loading dashboard..." />
      </div>

      <!-- Error / not found -->
      <div v-else-if="error" class="flex items-center justify-center h-64">
        <EmptyState
          title="Dashboard not found"
          message="This dashboard doesn't exist or hasn't been made public."
          icon="🔒"
        />
      </div>

      <template v-else-if="dashboard">
        <!-- Page tabs -->
        <div v-if="dashboard.pages.length > 1" class="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
          <button
            v-for="page in dashboard.pages"
            :key="page.id"
            @click="activePage = page.id"
            class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
            :class="activePage === page.id
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'"
          >
            {{ page.title }}
          </button>
        </div>

        <!-- Grid -->
        <DashboardGrid
          v-if="currentPage"
          :components="currentPage.components"
          :editable="false"
        />
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { Dashboard } from '@etl-dashboard/shared';

/**
 * Public dashboard view — no authentication required.
 * Fetches from /api/public/dashboard/:id which only returns published dashboards.
 */
definePageMeta({ layout: false });

const route = useRoute();
const { $api } = useApi();

const activePage = ref('');
const dashboard = ref<Dashboard | null>(null);
const loading = ref(true);
const error = ref(false);

onMounted(async () => {
  try {
    const res = await $api<{ success: boolean; data: Dashboard }>(
      `/public/dashboard/${route.params.id}`,
    );
    dashboard.value = res.data;
    if (res.data.pages.length > 0) {
      activePage.value = res.data.pages[0].id;
    }
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
});

const currentPage = computed(() =>
  dashboard.value?.pages.find((p) => p.id === activePage.value),
);
</script>
