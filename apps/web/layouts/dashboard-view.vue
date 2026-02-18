<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">ETL Dashboard</h1>
      <NuxtLink to="/dashboard" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
        Back to dashboard
      </NuxtLink>
    </header>
    <main class="p-6">
      <slot />
    </main>
  </div>
</template>
