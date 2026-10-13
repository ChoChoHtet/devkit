<script setup lang="ts">
useHead({
  titleTemplate: (title?: string): string => (title ? `${title} · DevKit` : 'DevKit'),
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
