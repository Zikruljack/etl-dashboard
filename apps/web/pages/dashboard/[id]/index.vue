<template>
  <div>
    <!-- Skeleton loading -->
    <template v-if="loading">
      <div class="mb-6">
        <SkeletonLoader variant="text" :lines="2" />
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonLoader v-for="n in 6" :key="n" variant="card" height="h-32" />
      </div>
    </template>

    <div v-else-if="dashboard">
      <PageHeader :title="dashboard.title" :description="dashboard.description || undefined" back-to="/dashboard">
        <template #badge>
          <StatusBadge v-if="dashboard.isPublished" status="published" label="Published" />
        </template>
        <template #actions>
          <a
            v-if="dashboard.isPublished"
            :href="`/public/dashboard/${dashboard.id}`"
            target="_blank"
            class="btn-secondary text-sm"
          >
            Public Link
          </a>
          <NuxtLink
            v-if="authStore.isEditor"
            :to="`/dashboard/${dashboard.id}/edit`"
            class="btn-primary"
          >
            Edit
          </NuxtLink>
        </template>
      </PageHeader>

      <!-- Page tabs -->
      <div v-if="dashboard.pages.length > 1" class="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
        <button
          v-for="page in dashboard.pages"
          :key="page.id"
          @click="activePage = page.id"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          :class="activePage === page.id
            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
        >
          {{ page.title }}
        </button>
      </div>

      <!-- Global filter bar -->
      <GlobalFilter v-model="globalFilter" />

      <!-- Dashboard grid (view mode) -->
      <DashboardGrid
        v-if="currentPage"
        :components="currentPage.components"
        :editable="false"
        :global-filter="globalFilter"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiResponse, Dashboard } from '@etl-dashboard/shared';
import type { DashboardFilter } from '~/components/dashboard/GlobalFilter.vue';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const authStore = useAuthStore();
const { $api } = useApi();

const activePage = ref('');
const globalFilter = ref<DashboardFilter>({ dateFrom: '', dateTo: '', extra: {} });

const { loading, data: dashboard } = useLoading(
  async () => {
    const res = await $api<ApiResponse<Dashboard>>(`/dashboard/${route.params.id}`);
    if (res.data.pages.length > 0) {
      activePage.value = res.data.pages[0].id;
    }
    return res.data;
  },
  { immediate: true },
);

/** Currently active page's data */
const currentPage = computed(() =>
  dashboard.value?.pages.find((p) => p.id === activePage.value),
);
</script>
