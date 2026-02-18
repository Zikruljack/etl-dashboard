<template>
  <div>
    <PageHeader title="Manage Dashboards" description="View, publish, and manage all dashboards">
      <template #actions>
        <NuxtLink
          to="/dashboard/new"
          class="btn-primary"
        >
          + New Dashboard
        </NuxtLink>
      </template>
    </PageHeader>

    <DataTable
      :columns="tableColumns"
      :rows="(dashboards as Record<string, unknown>[])"
      :loading="loading"
      empty-title="No dashboards yet"
      empty-message="Create your first dashboard to visualize data"
    >
      <template #cell-title="{ row }">
        <NuxtLink :to="`/dashboard/${(row as Record<string, unknown>).id}`" class="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
          {{ (row as Record<string, unknown>).title }}
        </NuxtLink>
        <p v-if="(row as Record<string, unknown>).description" class="text-xs text-gray-400 mt-0.5">
          {{ (row as Record<string, unknown>).description }}
        </p>
      </template>
      <template #cell-status="{ row }">
        <button
          @click.stop="togglePublish(row as Record<string, unknown>)"
          class="text-xs px-2.5 py-1 rounded-full cursor-pointer font-medium transition-colors"
          :class="(row as Record<string, unknown>).isPublished
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
        >
          {{ (row as Record<string, unknown>).isPublished ? 'Published' : 'Draft' }}
        </button>
      </template>
      <template #cell-pages="{ row }">
        <span class="text-gray-500">{{ ((row as Record<string, unknown>).pages as unknown[])?.length || 0 }} pages</span>
      </template>
      <template #cell-createdAt="{ value }">
        <span class="text-gray-400">{{ new Date(String(value)).toLocaleDateString() }}</span>
      </template>
      <template #actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <NuxtLink
            :to="`/dashboard/${(row as Record<string, unknown>).id}/edit`"
            class="text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            Edit
          </NuxtLink>
          <button
            @click="handleDelete(String((row as Record<string, unknown>).id))"
            class="text-red-600 hover:text-red-800 text-xs font-medium"
          >
            Delete
          </button>
        </div>
      </template>
    </DataTable>

    <ConfirmDialog
      :open="confirmState.isOpen.value"
      :title="confirmState.title.value"
      :message="confirmState.message.value"
      :variant="confirmState.variant.value"
      @confirm="confirmState.handleConfirm"
      @cancel="confirmState.handleCancel"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiResponse, Dashboard } from '@etl-dashboard/shared';

definePageMeta({ middleware: 'auth', layout: 'admin' });

const { $api } = useApi();
const confirmState = useConfirm();
const toast = useToast();

const tableColumns = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'pages', label: 'Pages' },
  { key: 'createdAt', label: 'Created', cellClass: 'text-gray-500' },
];

const { loading, data: dashboards, execute: loadDashboards } = useLoading(
  () => $api<ApiResponse<Dashboard[]>>('/dashboard').then((r) => r.data),
  { immediate: true },
);

async function togglePublish(dashboard: Record<string, unknown>) {
  try {
    await $api(`/dashboard/${dashboard.id}`, {
      method: 'PATCH',
      body: { isPublished: !dashboard.isPublished },
    });
    dashboard.isPublished = !dashboard.isPublished;
    toast.success(dashboard.isPublished ? 'Dashboard published' : 'Dashboard unpublished');
  } catch (e) {
    console.error('Failed to toggle publish', e);
    toast.error('Failed to update publish status');
  }
}

async function handleDelete(id: string) {
  const ok = await confirmState.confirm({
    title: 'Delete Dashboard',
    message: 'Are you sure you want to delete this dashboard? This action cannot be undone.',
  });
  if (!ok) return;

  try {
    await $api(`/dashboard/${id}`, { method: 'DELETE' });
    if (dashboards.value) {
      dashboards.value = dashboards.value.filter((d) => d.id !== id);
    }
    toast.success('Dashboard deleted');
  } catch (e) {
    console.error('Delete failed', e);
    toast.error('Failed to delete dashboard');
  }
}
</script>
