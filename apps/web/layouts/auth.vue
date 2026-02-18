<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
    <div class="w-full max-w-md px-4">
      <div class="text-center mb-8">
        <span class="text-5xl mb-3 inline-block">📊</span>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">ETL Dashboard</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">Data visualization platform</p>
      </div>
      <slot />
    </div>
  </div>
</template>
