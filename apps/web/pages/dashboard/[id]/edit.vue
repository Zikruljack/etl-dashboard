<template>
  <div>
    <LoadingState v-if="loading" />

    <div v-else-if="dashboard">
      <!-- Toolbar -->
      <div class="flex items-center justify-between mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center gap-3">
          <NuxtLink :to="`/dashboard/${dashboard.id}`" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            &larr;
          </NuxtLink>
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ dashboard.title }}</h1>
          <StatusBadge status="syncing" label="Editing" />
        </div>
        <div class="flex gap-2">
          <div class="relative" ref="addMenuRef">
            <button
              @click="showAddMenu = !showAddMenu"
              class="btn-success"
            >
              <span class="text-lg leading-none">+</span> Add Widget
            </button>
            <Transition
              enter-active-class="transition-all duration-150 ease-out"
              leave-active-class="transition-all duration-100 ease-in"
              enter-from-class="opacity-0 scale-95 -translate-y-1"
              leave-to-class="opacity-0 scale-95 -translate-y-1"
            >
              <div
                v-if="showAddMenu"
                class="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1.5 z-10 w-44"
              >
                <button
                  v-for="type in widgetTypes"
                  :key="type.value"
                  @click="addWidget(type.value)"
                  class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 transition-colors"
                >
                  {{ type.icon }} {{ type.label }}
                </button>
              </div>
            </Transition>
          </div>
          <button
            @click="save"
            :disabled="saving || !editorStore.isDirty"
            class="btn-primary"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>

      <!-- Page tabs -->
      <div class="flex gap-1 mb-4 border-b border-gray-200">
        <button
          v-for="page in dashboard.pages"
          :key="page.id"
          @click="switchPage(page.id)"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          :class="activePage === page.id
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'"
        >
          {{ page.title }}
        </button>
        <button
          @click="addPage"
          class="px-3 py-2 text-sm text-gray-400 hover:text-gray-600"
        >
          +
        </button>
      </div>

      <!-- Grid editor + Config panel -->
      <div class="flex gap-4">
        <div class="flex-1">
          <DashboardGrid
            :components="editorStore.components"
            :editable="true"
            @layout-updated="editorStore.updateLayout($event)"
            @select="editorStore.selectComponent($event)"
            @remove="editorStore.removeComponent($event)"
          />
        </div>

        <!-- Config panel -->
        <div v-if="editorStore.selectedComponent" class="w-80 shrink-0">
          <ComponentConfig
            :component="editorStore.selectedComponent"
            @update="(updates) => editorStore.updateComponent(editorStore.selectedComponentId!, updates)"
            @close="editorStore.selectComponent(null)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComponentType, ApiResponse, Dashboard, DashboardComponent, DashboardPage } from '@etl-dashboard/shared';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const { $api } = useApi();
const editorStore = useEditorStore();
const toast = useToast();

const saving = ref(false);
const activePage = ref('');
const showAddMenu = ref(false);
const addMenuRef = ref<HTMLElement>();

/** Close add widget dropdown when clicking outside */
function onClickOutside(e: MouseEvent) {
  if (addMenuRef.value && !addMenuRef.value.contains(e.target as Node)) {
    showAddMenu.value = false;
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));

/** Available widget types for the "Add Widget" dropdown */
const widgetTypes = [
  { value: 'table' as const, label: 'Table', icon: '📋' },
  { value: 'chart' as const, label: 'Chart', icon: '📊' },
  { value: 'map' as const, label: 'Map', icon: '🗺️' },
  { value: 'timeline' as const, label: 'Timeline', icon: '📅' },
  { value: 'kpi' as const, label: 'KPI', icon: '🔢' },
];

const { loading, data: dashboard } = useLoading(
  async () => {
    const res = await $api<ApiResponse<Dashboard>>(`/dashboard/${route.params.id}`);
    if (res.data.pages.length > 0) {
      activePage.value = res.data.pages[0].id;
      editorStore.loadComponents(res.data.pages[0].components);
    }
    return res.data;
  },
  { immediate: true },
);

/**
 * Switch to a different page tab and load its components into the editor.
 *
 * @param pageId - The page ID to switch to
 */
function switchPage(pageId: string) {
  activePage.value = pageId;
  const page = dashboard.value?.pages.find((p) => p.id === pageId);
  if (page) {
    editorStore.loadComponents(page.components);
  }
}

/**
 * Add a new widget to the grid.
 *
 * @param type - Widget type to add
 */
function addWidget(type: ComponentType) {
  editorStore.addComponent(type);
  showAddMenu.value = false;
}

/**
 * Add a new page to the dashboard.
 */
async function addPage() {
  try {
    const res = await $api<ApiResponse<DashboardPage>>(`/dashboard/${route.params.id}/pages`, {
      method: 'POST',
      body: { title: `Page ${(dashboard.value?.pages.length ?? 0) + 1}` },
    });
    dashboard.value?.pages.push(res.data);
    switchPage(res.data.id);
  } catch (e) {
    console.error('Failed to add page', e);
  }
}

/**
 * Save the current page's component layout and configs.
 * After save, updates the local dashboard cache and editor store
 * with DB-generated data to prevent stale data on page switch.
 */
async function save() {
  if (!activePage.value) return;
  saving.value = true;
  try {
    const components = editorStore.components.map((c) => ({
      type: c.type,
      title: c.title,
      layout: c.layout,
      config: c.config,
      datasetId: c.datasetId || undefined,
    }));
    const res = await $api<ApiResponse<DashboardComponent[]>>(
      `/dashboard/${route.params.id}/pages/${activePage.value}/components`,
      { method: 'PUT', body: { components } },
    );

    // Update local dashboard cache so switchPage() uses fresh data
    if (dashboard.value) {
      const pageIdx = dashboard.value.pages.findIndex((p) => p.id === activePage.value);
      if (pageIdx !== -1) {
        dashboard.value.pages[pageIdx].components = res.data;
      }
    }

    // Reload editor store with DB-generated IDs
    editorStore.loadComponents(res.data);
    toast.success('Dashboard saved');
  } catch (e) {
    console.error('Failed to save', e);
    toast.error('Failed to save dashboard');
  } finally {
    saving.value = false;
  }
}
</script>
