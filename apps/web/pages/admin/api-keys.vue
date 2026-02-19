<template>
  <div class="max-w-5xl mx-auto">
    <PageHeader title="API Keys — Admin" />

    <!-- Loading -->
    <LoadingState v-if="loading" message="Loading API keys..." />

    <!-- Error -->
    <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Empty -->
    <EmptyState
      v-else-if="keys.length === 0"
      title="No API Keys"
      message="No users have generated API keys yet."
    />

    <!-- Keys table -->
    <div v-else class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">User</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Key Name</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Prefix</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Rate Limits</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Last Used</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-for="key in keys" :key="key.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <td class="px-4 py-3">
              <div>
                <p class="font-medium text-gray-900 dark:text-gray-100">{{ key.userName }}</p>
                <p class="text-xs text-gray-400 dark:text-gray-500">{{ key.userEmail }}</p>
              </div>
            </td>
            <td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ key.name }}</td>
            <td class="px-4 py-3">
              <code class="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs font-mono">{{ key.keyPrefix }}...</code>
            </td>
            <td class="px-4 py-3">
              <!-- Inline editable rate limits -->
              <div v-if="editingId === key.id" class="flex items-center gap-1.5">
                <input
                  v-model.number="editHour"
                  type="number"
                  min="0"
                  placeholder="hr"
                  class="w-16 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                />
                <span class="text-gray-400 text-xs">/hr</span>
                <input
                  v-model.number="editDay"
                  type="number"
                  min="0"
                  placeholder="day"
                  class="w-16 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                />
                <span class="text-gray-400 text-xs">/day</span>
                <button class="text-xs text-green-600 hover:text-green-700 font-medium ml-1" @click="saveLimits(key.id)">Save</button>
                <button class="text-xs text-gray-400 hover:text-gray-600" @click="editingId = null">✕</button>
              </div>
              <button v-else class="text-left text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" @click="startEdit(key)">
                <span v-if="key.rateLimitPerHour || key.rateLimitPerDay">
                  <span v-if="key.rateLimitPerHour">{{ key.rateLimitPerHour }}/hr</span>
                  <span v-if="key.rateLimitPerHour && key.rateLimitPerDay"> · </span>
                  <span v-if="key.rateLimitPerDay">{{ key.rateLimitPerDay }}/day</span>
                </span>
                <span v-else class="text-gray-400 dark:text-gray-500">Unlimited</span>
                <span class="text-xs text-blue-500 ml-1">(edit)</span>
              </button>
            </td>
            <td class="px-4 py-3">
              <StatusBadge :status="key.isActive ? 'success' : 'error'" :label="key.isActive ? 'Active' : 'Revoked'" />
            </td>
            <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
              {{ key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never' }}
            </td>
            <td class="px-4 py-3">
              <button
                class="text-xs text-red-500 hover:text-red-700 font-medium"
                @click="deleteKey(key.id)"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
/**
 * Admin API Keys page.
 * Lists all API keys across all users; allows editing rate limits and deleting keys.
 */

import type { ApiResponse, ApiKeyWithUser } from '@etl-dashboard/shared';

definePageMeta({ middleware: 'auth', layout: 'admin' });

const { $api } = useApi();
const confirm = useConfirm();

const loading = ref(true);
const error = ref<string | null>(null);
const keys = ref<ApiKeyWithUser[]>([]);

// Edit state
const editingId = ref<string | null>(null);
const editHour = ref<number | null>(null);
const editDay = ref<number | null>(null);

/**
 * Fetch all API keys (admin view).
 */
async function fetchKeys() {
  loading.value = true;
  error.value = null;
  try {
    const res = await $api<ApiResponse<ApiKeyWithUser[]>>('/api-keys/admin');
    keys.value = res.data ?? [];
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err?.data?.message || 'Failed to load API keys';
  } finally {
    loading.value = false;
  }
}

/**
 * Start editing rate limits for a key.
 *
 * @param key - The API key to edit
 */
function startEdit(key: ApiKeyWithUser) {
  editingId.value = key.id;
  editHour.value = key.rateLimitPerHour ?? null;
  editDay.value = key.rateLimitPerDay ?? null;
}

/**
 * Save updated rate limits for a key.
 *
 * @param id - API key ID
 */
async function saveLimits(id: string) {
  try {
    await $api(`/api-keys/admin/${id}`, {
      method: 'PATCH',
      body: {
        rateLimitPerHour: editHour.value || null,
        rateLimitPerDay: editDay.value || null,
      },
    });
    const idx = keys.value.findIndex((k) => k.id === id);
    if (idx >= 0) {
      keys.value[idx] = {
        ...keys.value[idx]!,
        rateLimitPerHour: editHour.value || null,
        rateLimitPerDay: editDay.value || null,
      };
    }
    editingId.value = null;
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err?.data?.message || 'Failed to save limits';
  }
}

/**
 * Delete an API key after confirmation.
 *
 * @param id - API key ID to delete
 */
async function deleteKey(id: string) {
  const confirmed = await confirm.ask('Delete this API key permanently? This cannot be undone.');
  if (!confirmed) return;
  try {
    await $api(`/api-keys/admin/${id}`, { method: 'DELETE' });
    keys.value = keys.value.filter((k) => k.id !== id);
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err?.data?.message || 'Failed to delete key';
  }
}

/**
 * Format a date string to a human-readable format.
 *
 * @param dateStr - ISO date string
 * @returns Formatted date
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

onMounted(fetchKeys);
</script>
