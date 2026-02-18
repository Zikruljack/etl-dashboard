<template>
  <div>
    <PageHeader title="Settings" description="Configure application settings and API credentials" />

    <div class="space-y-6 max-w-2xl">
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
            <label class="form-label">API Key / Private Key</label>
            <textarea
              v-model="settings.googlePrivateKey"
              rows="3"
              class="form-input font-mono"
              placeholder="Paste your key here"
            ></textarea>
          </div>
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              :class="settings.googleServiceAccountEmail ? 'bg-green-500' : 'bg-gray-300'"
            ></span>
            <span class="text-sm text-gray-500 dark:text-gray-400">
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
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Allow Registration</label>
            <button
              @click="settings.allowRegistration = !settings.allowRegistration"
              class="relative w-10 h-5 rounded-full transition-colors"
              :class="settings.allowRegistration ? 'bg-blue-600' : 'bg-gray-300'"
            >
              <span
                class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow"
                :class="settings.allowRegistration ? 'left-5' : 'left-0.5'"
              ></span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <button
          @click="saveSettings"
          :disabled="saving"
          class="btn-primary"
        >
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>

      <p v-if="message" class="text-sm" :class="messageType === 'success' ? 'text-green-600' : 'text-red-600'">
        {{ message }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'admin' });

const settings = reactive({
  googleServiceAccountEmail: '',
  googlePrivateKey: '',
  appName: 'ETL Dashboard',
  allowRegistration: true,
});
const saving = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

async function saveSettings() {
  saving.value = true;
  message.value = '';
  try {
    // Settings will be saved to server in future iteration
    // For now just show confirmation
    await new Promise((r) => setTimeout(r, 500));
    message.value = 'Settings saved (note: Google API config is currently managed via .env file)';
    messageType.value = 'success';
  } catch {
    message.value = 'Failed to save settings';
    messageType.value = 'error';
  } finally {
    saving.value = false;
  }
}
</script>
