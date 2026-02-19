<template>
  <div class="space-y-4">
    <!-- URL -->
    <div>
      <label class="form-label">Endpoint URL</label>
      <input
        v-model="config.url"
        type="url"
        class="form-input"
        placeholder="https://api.example.com/data"
      />
    </div>

    <!-- Method -->
    <div>
      <label class="form-label">HTTP Method</label>
      <select v-model="config.method" class="form-input">
        <option value="GET">GET</option>
        <option value="POST">POST</option>
      </select>
    </div>

    <!-- Auth Type -->
    <div>
      <label class="form-label">Authentication</label>
      <select v-model="config.authType" class="form-input">
        <option value="none">No Authentication</option>
        <option value="bearer">Bearer Token</option>
        <option value="api_key_header">API Key in Header</option>
        <option value="basic">Basic Auth (Username + Password)</option>
      </select>
    </div>

    <!-- Bearer Token -->
    <div v-if="config.authType === 'bearer'">
      <label class="form-label">Bearer Token</label>
      <input v-model="config.authToken" type="password" class="form-input" placeholder="your-token-here" />
    </div>

    <!-- API Key in Header -->
    <div v-if="config.authType === 'api_key_header'" class="grid grid-cols-2 gap-3">
      <div>
        <label class="form-label">Header Name</label>
        <input v-model="config.authHeaderName" type="text" class="form-input" placeholder="X-API-Key" />
      </div>
      <div>
        <label class="form-label">Key Value</label>
        <input v-model="config.authToken" type="password" class="form-input" placeholder="your-api-key" />
      </div>
    </div>

    <!-- Basic Auth -->
    <div v-if="config.authType === 'basic'" class="grid grid-cols-2 gap-3">
      <div>
        <label class="form-label">Username</label>
        <input v-model="config.authUsername" type="text" class="form-input" placeholder="username" />
      </div>
      <div>
        <label class="form-label">Password</label>
        <input v-model="config.authPassword" type="password" class="form-input" placeholder="password" />
      </div>
    </div>

    <!-- POST body -->
    <div v-if="config.method === 'POST'">
      <label class="form-label">Request Body (JSON)</label>
      <textarea
        v-model="config.requestBody"
        class="form-input font-mono text-xs"
        rows="4"
        placeholder='{"query": "...", "filters": {}}'
      />
    </div>

    <!-- JSON Path -->
    <div>
      <label class="form-label">
        JSON Path
        <span class="text-xs text-gray-400 font-normal ml-1">(optional — dot-notation to extract nested array)</span>
      </label>
      <input
        v-model="config.jsonPath"
        type="text"
        class="form-input font-mono"
        placeholder='e.g. data.items or results'
      />
      <p class="text-xs text-gray-400 mt-1">
        Leave empty if the response root is already an array. Example: <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">data.items</code>
        will extract <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">response.data.items</code>.
      </p>
    </div>

    <!-- Extra Headers -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="form-label mb-0">Extra Headers</label>
        <button type="button" class="text-xs text-blue-600 hover:text-blue-700 font-medium" @click="addHeader">
          + Add Header
        </button>
      </div>
      <div v-for="(header, idx) in extraHeaders" :key="idx" class="flex gap-2 mb-2">
        <input
          v-model="header.key"
          type="text"
          class="form-input flex-1 text-sm"
          placeholder="Header-Name"
          @input="syncHeaders"
        />
        <input
          v-model="header.value"
          type="text"
          class="form-input flex-1 text-sm"
          placeholder="value"
          @input="syncHeaders"
        />
        <button
          type="button"
          class="text-red-400 hover:text-red-600 text-sm px-2"
          @click="removeHeader(idx)"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Test Connection -->
    <div class="pt-2">
      <button
        type="button"
        class="btn-primary"
        :disabled="!config.url || testing"
        @click="testConnection"
      >
        {{ testing ? 'Testing...' : 'Test Connection' }}
      </button>
      <div v-if="testResult" class="mt-3 p-3 rounded-lg text-sm" :class="testResult.ok ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'">
        {{ testResult.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * REST API connector configuration form.
 * Emits config changes and handles test connection.
 */

const { $api } = useApi();

/** REST connector config state */
const config = reactive({
  url: '',
  method: 'GET' as 'GET' | 'POST',
  authType: 'none' as 'none' | 'bearer' | 'api_key_header' | 'basic',
  authToken: '',
  authHeaderName: 'X-API-Key',
  authUsername: '',
  authPassword: '',
  requestBody: '',
  jsonPath: '',
  extraHeaders: {} as Record<string, string>,
});

/** Extra headers as editable array */
const extraHeaders = ref<{ key: string; value: string }[]>([]);

const testing = ref(false);
const testResult = ref<{ ok: boolean; message: string } | null>(null);

/** Sync extraHeaders array → config.extraHeaders object */
function syncHeaders() {
  config.extraHeaders = Object.fromEntries(
    extraHeaders.value
      .filter((h) => h.key.trim())
      .map((h) => [h.key.trim(), h.value]),
  );
}

function addHeader() {
  extraHeaders.value.push({ key: '', value: '' });
}

function removeHeader(idx: number) {
  extraHeaders.value.splice(idx, 1);
  syncHeaders();
}

/** Expose config for parent to read */
defineExpose({ config });

/** Test connection to the REST endpoint */
async function testConnection() {
  if (!config.url) return;
  testing.value = true;
  testResult.value = null;

  try {
    const res = await $api<{ success: boolean; data: { sampleRows: number; columns: string[] } }>(
      '/sources/connect',
      {
        method: 'POST',
        body: {
          sourceType: 'rest_api',
          sourceConfig: buildSourceConfig(),
        },
      },
    );
    testResult.value = {
      ok: true,
      message: `Connected. Found ${res.data.sampleRows} rows, ${res.data.columns.length} columns: ${res.data.columns.slice(0, 5).join(', ')}${res.data.columns.length > 5 ? '...' : ''}`,
    };
  } catch (err: unknown) {
    const e = err as { data?: { message?: string }; message?: string };
    testResult.value = {
      ok: false,
      message: e?.data?.message || e?.message || 'Connection failed',
    };
  } finally {
    testing.value = false;
  }
}

/** Build sourceConfig object for API calls */
function buildSourceConfig() {
  return {
    connector: 'rest_api',
    url: config.url,
    method: config.method,
    authType: config.authType,
    authToken: config.authToken || undefined,
    authHeaderName: config.authHeaderName || undefined,
    authUsername: config.authUsername || undefined,
    authPassword: config.authPassword || undefined,
    requestBody: config.requestBody || undefined,
    jsonPath: config.jsonPath || undefined,
    extraHeaders: Object.keys(config.extraHeaders).length ? config.extraHeaders : undefined,
  };
}
</script>
