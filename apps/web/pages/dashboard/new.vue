<template>
  <div class="max-w-lg mx-auto">
    <PageHeader title="Create Dashboard" back-to="/dashboard" />

    <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <form @submit.prevent="handleCreate" class="space-y-5">
        <div>
          <label class="form-label">Title</label>
          <input
            v-model="form.title"
            type="text"
            required
            class="form-input"
            placeholder="Dashboard title"
          />
        </div>

        <div>
          <label class="form-label">Description</label>
          <textarea
            v-model="form.description"
            rows="3"
            class="form-input"
            placeholder="Optional description"
          ></textarea>
        </div>

        <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {{ error }}
        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            :disabled="loading"
            class="btn-primary"
          >
            {{ loading ? 'Creating...' : 'Create Dashboard' }}
          </button>
          <NuxtLink to="/dashboard" class="btn-secondary">
            Cancel
          </NuxtLink>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiResponse, CreateDashboardRequest } from '@etl-dashboard/shared';

definePageMeta({ middleware: 'auth' });

const { $api } = useApi();

const form = reactive<CreateDashboardRequest>({ title: '', description: '' });
const loading = ref(false);
const error = ref('');

/**
 * Create a new dashboard and navigate to its editor.
 */
async function handleCreate() {
  loading.value = true;
  error.value = '';
  try {
    const res = await $api<ApiResponse<{ id: string }>>('/dashboard', {
      method: 'POST',
      body: form,
    });
    navigateTo(`/dashboard/${res.data.id}/edit`);
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err?.data?.message || 'Failed to create dashboard';
  } finally {
    loading.value = false;
  }
}
</script>
