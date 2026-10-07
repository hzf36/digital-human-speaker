<template>
  <main class="app">
    <section class="stage" aria-label="数字人展示区">
      <Live2DAvatar ref="avatarRef" />
    </section>
    <aside class="panel" aria-label="讲解操作区">
      <h1>数字人讲解</h1>
      <p class="hint">人物显示在页面上半部分。输入中文后开始播报，嘴巴会随音量开合。</p>
      <label>
        讲解内容
        <textarea
          v-model="scriptText"
          rows="5"
          placeholder="请输入要讲解的中文内容"
          :aria-invalid="scriptError ? 'true' : 'false'"
        ></textarea>
      </label>
      <p v-if="scriptError" class="form-error" role="alert">{{ scriptError }}</p>
      <label>
        表情
        <select v-model="emotion">
          <option value="平静">平静</option>
          <option value="开心">开心</option>
          <option value="严肃">严肃</option>
          <option value="难过">难过</option>
        </select>
      </label>
      <label>
        强度 {{ intensity.toFixed(2) }}
        <input v-model.number="intensity" type="range" min="0" max="1" step="0.01" />
      </label>
      <label>
        口型 {{ mouth.toFixed(2) }}
        <input v-model.number="mouth" type="range" min="0" max="1" step="0.01" :disabled="speaking" />
      </label>
      <div class="actions">
        <button type="button" :disabled="speaking" @click="startBroadcast">开始播报</button>
        <button type="button" @click="stopBroadcast">停止播报</button>
        <button type="button" @click="resetSettings">恢复默认</button>
      </div>
    </aside>
  </main>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Live2DAvatar from './components/Live2DAvatar.vue'
import { createSpeechBroadcast } from './speech/broadcast.js'

const EXPRESSION_KEY = 'digital-human-expression'
const EMOTIONS = ['平静', '开心', '严肃', '难过']

const avatarRef = ref(null)
const scriptText = ref('')
const scriptError = ref('')
const speaking = ref(false)
const mouth = ref(0)

const storedExpression = readExpression()
const emotion = ref(storedExpression.emotion)
const intensity = ref(storedExpression.intensity)

const broadcaster = createSpeechBroadcast({
  onLevel(level) {
    mouth.value = level
    avatarRef.value?.setMouth(level)
  },
  onEnd() {
    speaking.value = false
    mouth.value = 0
    avatarRef.value?.setMouth(0)
  },
})

function readExpression() {
  const fallback = { emotion: '平静', intensity: 0.7 }
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPRESSION_KEY) || '')
    const emotionName = EMOTIONS.includes(parsed.emotion) ? parsed.emotion : fallback.emotion
    const value = Number(parsed.intensity)
    const strength = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback.intensity
    return { emotion: emotionName, intensity: strength }
  } catch {
    return fallback
  }
}

function persistExpression() {
  localStorage.setItem(
    EXPRESSION_KEY,
    JSON.stringify({ emotion: emotion.value, intensity: intensity.value }),
  )
}

function applyEmotion() {
  avatarRef.value?.setEmotion(emotion.value, intensity.value)
}

async function startBroadcast() {
  const text = scriptText.value.trim()
  if (!text) {
    scriptError.value = '请输入讲解内容'
    return
  }
  if (speaking.value) return
  scriptError.value = ''
  speaking.value = true
  try {
    await broadcaster.start(text)
  } catch (error) {
    speaking.value = false
    mouth.value = 0
    avatarRef.value?.setMouth(0)
    scriptError.value = error?.message || '语音播报失败'
  }
}

function stopBroadcast() {
  broadcaster.stop()
}

function resetSettings() {
  emotion.value = '平静'
  intensity.value = 0.7
  if (!speaking.value) mouth.value = 0
}

watch(scriptText, () => {
  if (scriptText.value.trim()) scriptError.value = ''
})

watch([emotion, intensity], () => {
  persistExpression()
  applyEmotion()
})

watch(mouth, () => {
  if (!speaking.value) avatarRef.value?.setMouth(mouth.value)
})

onMounted(() => {
  window.speechSynthesis?.getVoices()
  applyEmotion()
  avatarRef.value?.setMouth(mouth.value)
})

onUnmounted(() => {
  broadcaster.dispose()
})
</script>
