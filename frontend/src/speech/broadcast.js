const PAUSE_CHAR = /[\s，。！？、；：,.!?;:…—]/

export function levelFromTimeDomain(samples) {
  if (!samples.length) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) {
    const centered = (samples[i] - 128) / 128
    sum += centered * centered
  }
  const rms = Math.sqrt(sum / samples.length)
  return Math.min(1, Math.max(0, rms / 0.45))
}

function pickChineseVoice(synth) {
  const voices = synth.getVoices()
  return (
    voices.find((voice) => voice.lang === 'zh-CN' && voice.localService) ||
    voices.find((voice) => voice.lang === 'zh-CN') ||
    voices.find((voice) => /^zh/i.test(voice.lang)) ||
    null
  )
}

export function createSpeechBroadcast({ onLevel, onEnd }) {
  let audioContext = null
  let analyser = null
  let gain = null
  let timeDomain = null
  let rafId = 0
  let keepAliveId = 0
  let active = false
  let token = 0
  let activity = 0
  let noiseSource = null
  let noiseStarted = false

  async function ensureGraph() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) throw new Error('当前浏览器不支持 Web Audio')
    if (!audioContext) {
      audioContext = new AudioCtx()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.65
      timeDomain = new Uint8Array(analyser.fftSize)
      gain = audioContext.createGain()
      gain.gain.value = 0
      const silent = audioContext.createGain()
      silent.gain.value = 0.00001
      const tone = audioContext.createOscillator()
      tone.type = 'sawtooth'
      tone.frequency.value = 180
      // SpeechSynthesis 没有音频输出节点，这里用与播报同步的增益驱动分析器，静音后才接到扬声器。
      tone.connect(gain)
      gain.connect(analyser)
      analyser.connect(silent)
      silent.connect(audioContext.destination)
      noiseSource = tone
    }
    if (audioContext.state === 'suspended') await audioContext.resume()
    if (noiseSource && !noiseStarted) {
      noiseSource.start()
      noiseStarted = true
    }
  }

  function readLevel() {
    analyser.getByteTimeDomainData(timeDomain)
    return levelFromTimeDomain(timeDomain)
  }

  function tick() {
    if (!active || !audioContext || !gain) return
    if (audioContext.state === 'suspended') audioContext.resume()
    const pulse = Math.abs(Math.sin(audioContext.currentTime * Math.PI * 3.2))
    const target = Math.min(1, Math.max(0, activity * (0.12 + 0.88 * pulse)))
    gain.gain.setValueAtTime(target, audioContext.currentTime)
    const level = readLevel()
    onLevel(level)
    rafId = requestAnimationFrame(tick)
  }

  function finish(id) {
    if (id !== token) return
    token += 1
    active = false
    activity = 0
    cancelAnimationFrame(rafId)
    rafId = 0
    window.clearInterval(keepAliveId)
    keepAliveId = 0
    if (gain && audioContext) {
      gain.gain.cancelScheduledValues(audioContext.currentTime)
      gain.gain.setValueAtTime(0, audioContext.currentTime)
    }
    onEnd()
  }

  function waitForVoices(synth) {
    if (synth.getVoices().length) return Promise.resolve()
    return new Promise((resolve) => {
      const timer = window.setTimeout(resolve, 400)
      synth.addEventListener(
        'voiceschanged',
        () => {
          window.clearTimeout(timer)
          resolve()
        },
        { once: true },
      )
    })
  }

  async function start(text) {
    const synth = window.speechSynthesis
    if (!synth || typeof SpeechSynthesisUtterance !== 'function') {
      throw new Error('当前浏览器不支持语音播报')
    }
    const wasBusy = synth.speaking || synth.pending
    token += 1
    const id = token
    if (wasBusy) synth.cancel()
    await ensureGraph()
    if (wasBusy) await new Promise((resolve) => window.setTimeout(resolve, 60))
    if (id !== token) return
    await waitForVoices(synth)
    if (id !== token) return

    active = true
    activity = 0.9
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    utterance.pitch = 1
    const voice = pickChineseVoice(synth)
    if (voice) utterance.voice = voice
    utterance.onboundary = (event) => {
      if (id !== token) return
      const char = text[event.charIndex] || ''
      if (PAUSE_CHAR.test(char)) {
        activity = 0
        return
      }
      activity = 0.55 + ((char.charCodeAt(0) || 1) % 45) / 100
    }
    utterance.onend = () => finish(id)
    utterance.onerror = () => finish(id)

    synth.speak(utterance)
    tick()
    keepAliveId = window.setInterval(() => {
      if (id !== token) return
      if (synth.speaking && !synth.paused) synth.resume()
    }, 8000)
  }

  function stop() {
    window.speechSynthesis?.cancel()
    finish(token)
  }

  function dispose() {
    stop()
    audioContext?.close()
    audioContext = null
    analyser = null
    gain = null
  }

  return { start, stop, dispose }
}
