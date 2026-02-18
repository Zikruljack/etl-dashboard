<template>
  <div>
    <PageHeader title="User Management" />

    <!-- Skeleton loading -->
    <SkeletonLoader v-if="loading" variant="table" :rows="6" />

    <DataTable
      v-else
      :columns="tableColumns"
      :rows="(users as Record<string, unknown>[])"
    >
      <template #cell-role="{ row }">
        <select
          :value="(row as Record<string, unknown>).role"
          @change="updateRole(String((row as Record<string, unknown>).id), ($event.target as HTMLSelectElement).value)"
          class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </template>
      <template #cell-createdAt="{ value }">
        {{ new Date(String(value)).toLocaleDateString() }}
      </template>
      <template #actions="{ row }">
        <button
          v-if="(row as Record<string, unknown>).id !== authStore.user?.id"
          @click="handleDelete(String((row as Record<string, unknown>).id))"
          class="text-red-600 hover:text-red-800 text-xs"
        >
          Delete
        </button>
      </template>
    </DataTable>

    <!-- Confirm dialog -->
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
import type { ApiResponse, User } from '@etl-dashboard/shared';

definePageMeta({ middleware: 'auth', layout: 'admin' });

const authStore = useAuthStore();
const { $api } = useApi();
const confirmState = useConfirm();
const toast = useToast();

/** Table column definitions */
const tableColumns = [
  { key: 'name', label: 'Name', cellClass: 'font-medium' },
  { key: 'email', label: 'Email', cellClass: 'text-gray-500' },
  { key: 'role', label: 'Role' },
  { key: 'createdAt', label: 'Joined', cellClass: 'text-gray-500' },
];

const { loading, data: users } = useLoading(
  () => $api<ApiResponse<User[]>>('/users').then((r) => r.data),
  { immediate: true },
);

/**
 * Update a user's role.
 *
 * @param userId - The user ID to update
 * @param role - The new role value
 */
async function updateRole(userId: string, role: string) {
  try {
    await $api(`/users/${userId}/role`, {
      method: 'PATCH',
      body: { role },
    });
    toast.success(`Role updated to ${role}`);
  } catch (e) {
    console.error('Failed to update role', e);
    toast.error('Failed to update role');
  }
}

/**
 * Delete a user with confirmation dialog.
 *
 * @param userId - The user ID to delete
 */
async function handleDelete(userId: string) {
  const ok = await confirmState.confirm({
    title: 'Delete User',
    message: 'Are you sure you want to delete this user? This action cannot be undone.',
  });
  if (!ok) return;

  try {
    await $api(`/users/${userId}`, { method: 'DELETE' });
    if (users.value) {
      users.value = users.value.filter((u) => u.id !== userId);
    }
    toast.success('User deleted');
  } catch (e) {
    console.error('Failed to delete user', e);
    toast.error('Failed to delete user');
  }
}
</script>
