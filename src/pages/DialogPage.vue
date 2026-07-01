<template>
  <div class="dialog-container">
    <div class="top-bar">
      <span class="title">{{ data.length ? data.length + ' segments' : 'FY27 Resource Gantt' }}</span>
      <div class="controls">
        <button :class="['btn', view === 'person' ? 'active' : '']" @click="view='person'">By Person</button>
        <button :class="['btn', view === 'project' ? 'active' : '']" @click="view='project'">By Project</button>
        <select v-if="view === 'project'" v-model="selProj" class="sel">
          <option v-for="p in projectList" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
    </div>

    <div v-if="error" class="err">{{ error }}</div>
    <div v-if="data.length" class="gantt-full">
      <GanttByPerson v-if="view === 'person'" :data="data" :colors="projectColors" />
      <GanttByProject v-if="view === 'project'" :data="filteredData" :colors="projectColors" />
    </div>
    <div v-else-if="!error" class="loading">Loading...</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import GanttByPerson from '../components/GanttByPerson.vue'
import GanttByProject from '../components/GanttByProject.vue'

const view = ref('person')
const selProj = ref('')
const data = ref([])
const error = ref('')

const projectList = computed(() => [...new Set(data.value.map(d => d.project))].filter(Boolean).sort())
const filteredData = computed(() => selProj.value ? data.value.filter(d => d.project === selProj.value) : data.value)

const COLORS = ['#4CAF50','#2196F3','#F44336','#FF9800','#9C27B0','#00BCD4',
                '#FF5722','#795548','#607D8B','#E91E63','#3F51B5','#8BC34A']
const projectColors = computed(() => {
  const map = {}
  projectList.value.forEach((p, i) => { map[p] = COLORS[i % COLORS.length] })
  return map
})

function monthIndex(dateVal) {
  if (!dateVal) return -1
  let d
  if (typeof dateVal === 'number' && dateVal > 40000) {
    d = new Date((dateVal - 25569) * 86400 * 1000)
  } else {
    d = new Date(dateVal)
  }
  return (d.getFullYear() - 2025) * 12 + d.getMonth() + 1 - 9
}
function clampMonth(idx) { return Math.max(0, Math.min(24, idx)) }

onMounted(() => {
  try {
    const hash = window.location.hash.slice(1)
    if (!hash) { error.value = 'No data received'; return }
    const decoded = JSON.parse(decodeURIComponent(hash))
    if (!Array.isArray(decoded) || !decoded.length) { error.value = 'Empty data'; return }
    data.value = decoded
  } catch (e) {
    error.value = e.message || String(e)
  }
})
</script>

<style scoped>
.dialog-container { padding: 0; }
.top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
.title { font-size: 14px; font-weight: bold; color: #333; }
.controls { display: flex; gap: 6px; align-items: center; }
.btn { padding: 4px 12px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; background: #fff; font-size: 12px; }
.btn.active { background: #366092; color: #fff; border-color: #366092; }
.sel { padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; }
.err { background: #ffebee; color: #c62828; padding: 8px; border-radius: 4px; }
.gantt-full { overflow: auto; }
.loading { text-align: center; padding: 60px; color: #999; font-size: 14px; }
</style>
