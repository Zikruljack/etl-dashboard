<template>
  <div>
    <PageHeader title="Settings" description="Configure application settings and API credentials" />

    <div class="space-y-6 max-w-2xl">
      <LoadingState v-if="loading" message="Loading settings..." />

      <template v-else>
        <!-- Google API Config -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold dark:text-gray-100 mb-4">Google Sheets API</h2>
          <div class="space-y-4">
            <div>
              <label class="form-label">Service Account Email</label>
              <input
                v-model="settings.googleServiceAccountEmail"
                type="text"
                class="form-input"
                placeholder="name@project.iam.gserviceaccount.com"
              />
            </div>
            <div>
              <label class="form-label">Private Key</label>
              <textarea
                v-model="settings.googlePrivateKey"
                rows="3"
                class="form-input font-mono"
                :placeholder="settings.googlePrivateKey === '***' ? 'Currently set — paste new key to update' : 'Paste your private key JSON here'"
              ></textarea>
              <p v-if="settings.googlePrivateKey === '***'" class="text-xs text-gray-400 mt-1">
                A key is currently saved. Leave as "***" to keep the existing value.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full"
                :class="settings.googleServiceAccountEmail && settings.googleServiceAccountEmail !== '' ? 'bg-green-500' : 'bg-gray-300'"
              ></span>
              <span class="text-sm text-gray-500 dark:text-gray-400">
                {{ settings.googleServiceAccountEmail ? 'Google API configured' : 'Not configured — Google Sheets won\'t work' }}
              </span>
            </div>
          </div>
        </div>

        <!-- App Settings -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold dark:text-gray-100 mb-4">Application</h2>
          <div class="space-y-4">
            <div>
              <label class="form-label">App Name</label>
              <input
                v-model="settings.appName"
                type="text"
                class="form-input"
              />
            </div>
            <div class="flex items-center gap-3">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Allow Self-Registration</label>
              <button
                @click="settings.allowRegistration = settings.allowRegistration === 'true' ? 'false' : 'true'"
                class="relative w-10 h-5 rounded-full transition-colors"
                :class="settings.allowRegistration === 'true' ? 'bg-blue-600' : 'bg-gray-300'"
              >
                <span
                  class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow"
                  :class="settings.allowRegistration === 'true' ? 'left-5' : 'left-0.5'"
                ></span>
              </button>
              <span class="text-xs text-gray-400">
                {{ settings.allowRegistration === 'true' ? 'Users can register via /register' : 'Registration disabled' }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex gap-3 items-center">
          <button
            @click="saveSettings"
            :disabled="saving"
            class="btn-primary"
          >
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
          <p v-if="message" class="text-sm" :class="messageType === 'success' ? 'text-green-600' : 'text-red-600'">
            {{ message }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'admin' });

const { $api } = useApi();

const settings = reactive<Record<string, string>>({
  googleServiceAccountEmail: '',
  googlePrivateKey: '',
  appName: 'ETL Dashboard',
  allowRegistration: 'true',
});
const loading = ref(true);
const saving = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

onMounted(async () => {
  try {
    const res = await $api<{ success: boolean; data: Record<string, string> }>('/admin/settings');
    Object.assign(settings, res.data);
  } catch (e) {
    console.error('Failed to load settings', e);
  } finally {
    loading.value = false;
  }
});

async function saveSettings() {
  saving.value = true;
  message.value = '';
  try {
    await $api('/admin/settings', {
      method: 'PATCH',
      body: { settings: { ...settings } },
    });
    message.value = 'Settings saved successfully';
    messageType.value = 'success';
    // Reload to get current redacted values
    const res = await $api<{ success: boolean; data: Record<string, string> }>('/admin/settings');
    Object.assign(settings, res.data);
  } catch {
    message.value = 'Failed to save settings';
    messageType.value = 'error';
  } finally {
    saving.value = false;
  }
}
</script>
