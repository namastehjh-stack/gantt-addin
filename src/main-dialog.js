import { createApp } from 'vue'
import DialogPage from './pages/DialogPage.vue'

Office.onReady(() => {
  createApp(DialogPage).mount('#app')
})
