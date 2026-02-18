<template>
  <div>
    <PageHeader title="Manage Datasets" description="View, sync, and manage all datasets">
      <template #actions>
        <NuxtLink
          to="/datasets/new"
          class="btn-primary"
        >
          + New Dataset
        </NuxtLink>
      </template>
    </PageHeader>

    <DataTable
      :columns="tableColumns"
      :rows="(datasets as Record<string, unknown>[])"
      :loading="loading"
      empty-title="No datasets yet"
      empty-message="Create your first dataset to get started"
    >
      <template #cell-name="{ row }">
        <NuxtLink :to="`/datasets/${(row as Record<string, unknown>).id}`" class="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
          {{ (row as Record<string, unknown>).name }}
        </NuxtLink>
        <p v-if="(row as Record<string, unknown>).description" class="text-xs text-gray-400 mt-0.5">
          {{ (row as Record<string, unknown>).description }}
        </p>
      </template>
      <template #cell-sourceType="{ value }">
        <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
          {{ value === 'google_sheets' ? '📊 Google Sheets' : value }}
        </span>
      </template>
      <template #cell-syncStatus="{ value }">
        <StatusBadge :status="String(value || 'idle')" />
      </template>
      <template #cell-columns="{ row }">
        <span class="text-gray-500">{{ ((row as Record<string, unknown>).columns as unknown[])?.length || 0 }} cols</span>
      </template>
      <template #cell-lastSyncedAt="{ value }">
        <span class="text-gray-400 text-xs">{{ value ? new Date(String(value)).toLocaleString() : 'Never' }}</span>
      </template>
      <template #actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            @click="syncDataset(String((row as Record<string, unknown>).id))"
            :disabled="syncing === String((row as Record<string, unknown>).id)"
            class="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50"
          >
            {{ syncing === String((row as Record<string, unknown>).id) ? 'Syncing...' : 'Sync' }}
          </button>
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
import type { ApiResponse, Dataset } from '@etl-dashboard/shared';

definePageMeta({ middleware: 'auth', layout: 'admin' });

const { $api } = useApi();
const confirmState = useConfirm();
const toast = useToast();
const syncing = ref<string | null>(null);

const tableColumns = [
  { key: 'name', label: 'Name' },
  { key: 'sourceType', label: 'Source' },
  { key: 'syncStatus', label: 'Status' },
  { key: 'columns', label: 'Columns' },
  { key: 'lastSyncedAt', label: 'Last Synced' },
];

const { loading, data: datasets, execute: loadDatasets } = useLoading(
  () => $api<ApiResponse<Dataset[]>>('/datasets').then((r) => r.data),
  { immediate: true },
);

async function syncDataset(id: string) {
  syncing.value = id;
  try {
    await $api(`/datasets/${id}/sync`, { method: 'POST' });
    await loadDatasets();
    toast.success('Dataset synced successfully');
  } catch (e) {
    console.error('Sync failed', e);
    toast.error('Failed to sync dataset');
  } finally {
    syncing.value = null;
  }
}

async function handleDelete(id: string) {
  const ok = await confirmState.confirm({
    title: 'Delete Dataset',
    message: 'Are you sure you want to delete this dataset and all its data? This action cannot be undone.',
  });
  if (!ok) return;

  try {
    await $api(`/datasets/${id}`, { method: 'DELETE' });
    if (datasets.value) {
      datasets.value = datasets.value.filter((d) => d.id !== id);
    }
    toast.success('Dataset deleted');
  } catch (e) {
    console.error('Delete failed', e);
    toast.error('Failed to delete dataset');
  }
}
</script>
