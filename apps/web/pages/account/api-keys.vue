<template>
  <div class="max-w-4xl mx-auto">
    <PageHeader title="API Keys">
      <template #actions>
        <button class="btn-primary" @click="showGenerateModal = true">
          + Generate Key
        </button>
      </template>
    </PageHeader>

    <!-- Info banner -->
    <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300">
      Use API keys to authenticate requests to the <code class="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded font-mono">/api/v1</code> endpoints.
      Pass the key via <code class="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded font-mono">Authorization: Bearer &lt;key&gt;</code> or
      <code class="bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 rounded font-mono">X-API-Key: &lt;key&gt;</code> header.
    </div>

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
      message="Generate an API key to access your datasets programmatically."
    />

    <!-- Keys table -->
    <div v-else class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Name</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Key Prefix</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Rate Limits</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Last Used</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Created</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-for="key in keys" :key="key.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{{ key.name }}</td>
            <td class="px-4 py-3">
              <code class="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs font-mono text-gray-700 dark:text-gray-300">{{ key.keyPrefix }}...</code>
            </td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400">
              <span v-if="key.rateLimitPerHour || key.rateLimitPerDay">
                <span v-if="key.rateLimitPerHour">{{ key.rateLimitPerHour }}/hr</span>
                <span v-if="key.rateLimitPerHour && key.rateLimitPerDay"> · </span>
                <span v-if="key.rateLimitPerDay">{{ key.rateLimitPerDay }}/day</span>
              </span>
              <span v-else class="text-gray-400 dark:text-gray-500">Unlimited</span>
            </td>
            <td class="px-4 py-3">
              <StatusBadge :status="key.isActive ? 'success' : 'error'" :label="key.isActive ? 'Active' : 'Revoked'" />
            </td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
              {{ key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never' }}
            </td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{{ formatDate(key.createdAt) }}</td>
            <td class="px-4 py-3">
              <button
                v-if="key.isActive"
                class="text-xs text-red-500 hover:text-red-700 font-medium"
                @click="revokeKey(key.id)"
              >
                Revoke
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Generate Key Modal -->
    <Teleport to="body">
      <div v-if="showGenerateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
          <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Generate API Key</h2>
            <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" @click="closeModal">&#10005;</button>
          </div>

          <!-- Step 1: Enter name -->
          <div v-if="!generatedKey" class="p-6 space-y-4">
            <div>
              <label class="form-label">Key Name</label>
              <input
                v-model="newKeyName"
                type="text"
                class="form-input"
                placeholder="e.g. My Integration, CI/CD Pipeline"
                @keydown.enter="generateKey"
              />
              <p class="form-hint">A descriptive name to identify this key.</p>
            </div>
            <div v-if="generateError" class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {{ generateError }}
            </div>
            <div class="flex justify-end gap-3">
              <button class="btn-secondary" @click="closeModal">Cancel</button>
              <button
                class="btn-primary"
                :disabled="!newKeyName.trim() || generating"
                @click="generateKey"
              >
                {{ generating ? 'Generating...' : 'Generate' }}
              </button>
            </div>
          </div>

          <!-- Step 2: Show generated key ONCE -->
          <div v-else class="p-6 space-y-4">
            <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
              &#9888; Copy this key now — it will <strong>never be shown again</strong>.
            </div>
            <div>
              <label class="form-label">Your API Key</label>
              <div class="flex gap-2">
                <code class="flex-1 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{{ generatedKey }}</code>
                <button
                  class="btn-secondary text-sm shrink-0"
                  @click="copyKey"
                >
                  {{ copied ? '✓ Copied' : 'Copy' }}
                </button>
              </div>
            </div>
            <div class="flex justify-end">
              <button class="btn-primary" @click="closeModal">Done</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Confirm Revoke -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
/**
 * Account API Keys page.
 * Lists the current user's API keys and allows generating new ones or revoking existing ones.
 */

import type { ApiResponse, ApiKey } from '@etl-dashboard/shared';

definePageMeta({ middleware: 'auth', layout: 'default' });

const { $api } = useApi();
const confirm = useConfirm();

const loading = ref(true);
const error = ref<string | null>(null);
const keys = ref<ApiKey[]>([]);

// Modal state
const showGenerateModal = ref(false);
const newKeyName = ref('');
const generating = ref(false);
const generateError = ref<string | null>(null);
const generatedKey = ref<string | null>(null);
const copied = ref(false);

/**
 * Fetch user's API keys from the server.
 */
async function fetchKeys() {
  loading.value = true;
  error.value = null;
  try {
    const res = await $api<ApiResponse<ApiKey[]>>('/api-keys');
    keys.value = res.data;
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err?.data?.message || 'Failed to load API keys';
  } finally {
    loading.value = false;
  }
}

/**
 * Generate a new API key with the given name.
 * Shows the full key once in the modal.
 */
async function generateKey() {
  if (!newKeyName.value.trim()) return;
  generating.value = true;
  generateError.value = null;
  try {
    const res = await $api<ApiResponse<{ id: string; name: string; fullKey: string; keyPrefix: string }>>('/api-keys', {
      method: 'POST',
      body: { name: newKeyName.value.trim() },
    });
    generatedKey.value = res.data.fullKey;
    await fetchKeys();
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    generateError.value = err?.data?.message || 'Failed to generate key';
  } finally {
    generating.value = false;
  }
}

/**
 * Revoke an API key after confirmation.
 *
 * @param id - API key ID to revoke
 */
async function revokeKey(id: string) {
  const confirmed = await confirm.ask('Revoke this API key? Any integrations using it will stop working.');
  if (!confirmed) return;
  try {
    await $api(`/api-keys/${id}`, { method: 'DELETE' });
    keys.value = keys.value.map((k) => k.id === id ? { ...k, isActive: false } : k);
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err?.data?.message || 'Failed to revoke key';
  }
}

/**
 * Copy the generated key to clipboard.
 */
async function copyKey() {
  if (!generatedKey.value) return;
  await navigator.clipboard.writeText(generatedKey.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

/**
 * Close the generate modal and reset state.
 */
function closeModal() {
  showGenerateModal.value = false;
  newKeyName.value = '';
  generating.value = false;
  generateError.value = null;
  generatedKey.value = null;
  copied.value = false;
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
