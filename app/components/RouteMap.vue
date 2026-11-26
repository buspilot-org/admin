<script setup lang="ts">
// MapLibre map of one route pattern: the shape and the stops in pattern
// order. A stop served twice gets two labels (its sequence numbers).
import { Map as MapLibreMap, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
// MapLibre finds its worker next to its own module file, which moves when
// bundled. Point it at the worker file that Vite emits as an asset.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { LngLat } from '~/utils/wkb'
import { bbox } from '~/utils/wkb'
import { DEFAULT_COLOR } from '~/utils/color'

export interface MapStop {
  sequence: number
  name: string
  coordinates: LngLat
}

const props = withDefaults(defineProps<{
  line: LngLat[] | null
  stops: MapStop[]
  color?: string
  height?: string
}>(), { color: DEFAULT_COLOR, height: '420px' })

const { t } = useI18n()
const config = useRuntimeConfig()
const container = ref<HTMLDivElement | null>(null)
const failed = ref(false)
let map: MapLibreMap | null = null
// Set on the first 'load'. isStyleLoaded() is also false while tiles load,
// which would drop updates.
let ready = false

function stopFeatures() {
  // Group visits per location, so a stop served twice shows "2 · 5".
  const byKey = new Map<string, { coordinates: LngLat, name: string, sequences: number[] }>()
  for (const s of props.stops) {
    const key = s.coordinates.join(',')
    const entry = byKey.get(key) ?? { coordinates: s.coordinates, name: s.name, sequences: [] }
    entry.sequences.push(s.sequence)
    byKey.set(key, entry)
  }
  return {
    type: 'FeatureCollection' as const,
    features: [...byKey.values()].map(s => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: s.coordinates },
      properties: { label: `${s.sequences.join(' · ')}  ${s.name}` },
    })),
  }
}

function lineFeature() {
  return {
    type: 'FeatureCollection' as const,
    features: props.line && props.line.length > 1
      ? [{ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: props.line }, properties: {} }]
      : [],
  }
}

function fit() {
  if (!map) return
  const box = bbox([...(props.line ?? []), ...props.stops.map(s => s.coordinates)])
  if (box) map.fitBounds(box, { padding: 48, maxZoom: 16, duration: 0 })
}

function render() {
  if (!map || !ready) return
  const color = `#${props.color}`
  const line = map.getSource('route-line') as GeoJSONSource | undefined
  const stops = map.getSource('route-stops') as GeoJSONSource | undefined
  if (line && stops) {
    line.setData(lineFeature())
    stops.setData(stopFeatures())
    map.setPaintProperty('route-line', 'line-color', color)
    map.setPaintProperty('route-stops', 'circle-stroke-color', color)
  }
  else {
    map.addSource('route-line', { type: 'geojson', data: lineFeature() })
    map.addSource('route-stops', { type: 'geojson', data: stopFeatures() })
    map.addLayer({ id: 'route-line', type: 'line', source: 'route-line', paint: { 'line-color': color, 'line-width': 5 }, layout: { 'line-join': 'round', 'line-cap': 'round' } })
    map.addLayer({ id: 'route-stops', type: 'circle', source: 'route-stops', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-width': 3, 'circle-stroke-color': color } })
    map.addLayer({
      id: 'route-stop-labels',
      type: 'symbol',
      source: 'route-stops',
      layout: { 'text-field': ['get', 'label'], 'text-size': 13, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'] },
      paint: { 'text-color': '#1b1b1b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    })
  }
  fit()
}

onMounted(() => {
  if (!container.value) return
  setWorkerUrl(workerUrl)
  try {
    map = new MapLibreMap({
      container: container.value,
      style: config.public.mapStyleUrl as string,
      center: [135.19, 34.7],
      zoom: 12,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      ready = true
      render()
    })
    map.on('error', (e: { error?: { message?: string } }) => {
      // Tile or glyph errors are not fatal; a failing style is.
      if (!ready && String(e.error?.message ?? '').includes('style')) failed.value = true
    })
  }
  catch {
    failed.value = true // e.g. no WebGL
  }
})

watch(() => [props.line, props.stops, props.color], render, { deep: true })

onBeforeUnmount(() => {
  map?.remove()
  map = null
  ready = false
})
</script>

<template>
  <div class="route-map rounded border" :style="{ height }">
    <div ref="container" class="w-100 h-100" role="region" :aria-label="t('routes.map')" />
    <div v-if="failed" class="route-map__error text-body-2 pa-4">{{ t('routes.mapFailed') }}</div>
  </div>
</template>

<style scoped>
.route-map {
  position: relative;
  overflow: hidden;
}
.route-map__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-surface));
}
</style>
