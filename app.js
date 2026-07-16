import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { dotMatrixShader } from './dotMatrixShader.js'

// ============================================================
// 常量
// ============================================================
const MODEL_URL = './koala-peace-v2.glb'
const DRACO_URL = './vendor/draco/'
const PARTICLE_COUNT = 14000
const SCALE = 2.5
const MOUSE_RADIUS = 0.85
const MOUSE_FORCE = 0.014
const SPRING = 0.022
const DAMPING = 0.86
const DISPERSE_SPEED = 0.13
const DISPERSE_DAMPING = 0.985
const DISPERSE_DURATION = 0.8
const OPACITY_MAX = 0.95

const SUGGESTIONS = [
  { text: "how do I run evals at scale?", icon: "M94.4,152.17A8,8,0,0,0,85,158.42a151,151,0,0,1-17.21,45.44,8,8,0,0,0,13.86,8,166.67,166.67,0,0,0,19-50.25A8,8,0,0,0,94.4,152.17ZM128,56a72.85,72.85,0,0,0-9,.56,8,8,0,0,0,2,15.87A56.08,56.08,0,0,1,184,128a252.12,252.12,0,0,1-1.92,31A8,8,0,0,0,189,168a8.39,8.39,0,0,0,1,.06,8,8,0,0,0,7.92-7,266.48,266.48,0,0,0,2-33A72.08,72.08,0,0,0,128,56Zm57.93,128.25a8,8,0,0,0-9.75,5.75c-1.46,5.69-3.15,11.4-5,17a8,8,0,0,0,5,10.13,7.88,7.88,0,0,0,2.55.42,8,8,0,0,0,7.58-5.46c2-5.92,3.79-12,5.35-18.05A8,8,0,0,0,185.94,184.26Z" },
  { text: "what is a warm pool?", icon: "M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a95.88,95.88,0,0,0-82.3,144.06l-9.82,35.91a16,16,0,0,0,19.81,19.81l35.91-9.82A96,96,0,1,0,128,16Zm0,176a79.83,79.83,0,0,1-40.7-11.12,8,8,0,0,0-6.21-.77L44,189.73l9.62-35.17a8,8,0,0,0-.77-6.21A80,80,0,1,1,128,192Z" },
  { text: "how to verify agent data?", icon: "M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Z" },
]

// ============================================================
// 状态
// ============================================================
let chatActive = false
let isStreaming = false
let messages = []
let msgId = 0
let animIn = false

// ============================================================
// Three.js 场景
// ============================================================
const container = document.getElementById('canvas-container')
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
camera.position.set(0, 1.5, 6)

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false })
renderer.setClearColor(0, 0)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2
container.appendChild(renderer.domElement)

const hemiLight = new THREE.HemisphereLight(0x9fd7ff, 0x0a0a10, 0.4)
scene.add(hemiLight)

// ============================================================
// 粒子系统
// ============================================================
let points = null
let pointsMaterial = null
let sourcePositions = null
let positions = null
let velocities = null
let centroid = new THREE.Vector3()
let dispersed = false
let disperseStarted = false
let disperseT0 = 0
const mouse = { ndcX: 0, ndcY: 0, active: false }
const mouseWorld = new THREE.Vector3(9999, 9999, 0)
const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

// Load GLB model and sample particles
const gltfLoader = new GLTFLoader()
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath(DRACO_URL)
gltfLoader.setDRACOLoader(dracoLoader)

gltfLoader.load(MODEL_URL, (gltf) => {
  const cloned = cloneSkeleton(gltf.scene)
  const box = new THREE.Box3().setFromObject(cloned)
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0) cloned.scale.multiplyScalar(SCALE / maxDim)
  box.setFromObject(cloned)
  const center = box.getCenter(new THREE.Vector3())
  cloned.position.sub(center)
  cloned.position.y -= 0.2
  cloned.updateMatrixWorld(true)

  const meshes = []
  cloned.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) meshes.push(child)
  })

  sourcePositions = new Float32Array(PARTICLE_COUNT * 3)
  if (meshes.length > 0) {
    const counts = meshes.map((m) => m.geometry.attributes.position.count)
    const total = counts.reduce((a, b) => a + b, 0) || 1
    const tmp = new THREE.Vector3()
    let idx = 0
    meshes.forEach((mesh, i) => {
      const n = i === meshes.length - 1
        ? PARTICLE_COUNT - idx
        : Math.floor(counts[i] / total * PARTICLE_COUNT)
      const sampler = new MeshSurfaceSampler(mesh).build()
      mesh.updateMatrixWorld(true)
      for (let j = 0; j < n && idx < PARTICLE_COUNT; j++) {
        sampler.sample(tmp)
        tmp.applyMatrix4(mesh.matrixWorld)
        sourcePositions[idx * 3] = tmp.x
        sourcePositions[idx * 3 + 1] = tmp.y
        sourcePositions[idx * 3 + 2] = tmp.z
        idx++
      }
    })
  }

  // Compute centroid
  centroid.set(0, 0, 0)
  const n = sourcePositions.length / 3
  for (let i = 0; i < sourcePositions.length; i += 3) {
    centroid.x += sourcePositions[i]
    centroid.y += sourcePositions[i + 1]
    centroid.z += sourcePositions[i + 2]
  }
  if (n > 0) centroid.divideScalar(n)

  positions = new Float32Array(sourcePositions)
  velocities = new Float32Array(sourcePositions.length)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  pointsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.032,
    sizeAttenuation: true,
    transparent: true,
    opacity: OPACITY_MAX,
    depthWrite: false,
  })

  points = new THREE.Points(geometry, pointsMaterial)
  scene.add(points)

  // Entrance animation
  requestAnimationFrame(() => requestAnimationFrame(() => {
    animIn = true
    container.classList.add('anim-in')
    document.getElementById('ask-form').classList.add('anim-in')
    document.getElementById('ask-suggestions').classList.add('anim-in')
  }))
})

// ============================================================
// Mouse interaction
// ============================================================
const el = renderer.domElement
el.addEventListener('pointermove', (e) => {
  const rect = el.getBoundingClientRect()
  mouse.ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
  mouse.active = true
}, { passive: true })
el.addEventListener('pointerleave', () => {
  mouse.active = false
  mouseWorld.set(9999, 9999, 0)
}, { passive: true })

// ============================================================
// Post-processing
// ============================================================
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const dotPass = new ShaderPass(dotMatrixShader(1, 1))
composer.addPass(dotPass)
composer.addPass(new OutputPass())

// ============================================================
// Resize
// ============================================================
function resize() {
  const rect = container.getBoundingClientRect()
  const w = Math.max(1, rect.width)
  const h = Math.max(1, rect.height)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
  composer.setSize(w, h)
  dotPass.uniforms.uResolution.value.set(w, h)
}
window.addEventListener('resize', resize)
// Delay initial resize to ensure layout is computed
requestAnimationFrame(() => requestAnimationFrame(resize))
// Also use ResizeObserver for robust sizing
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(resize).observe(container)
}

// ============================================================
// Animation loop
// ============================================================
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.033)
  const t = clock.elapsedTime

  if (!points) {
    composer.render()
    return
  }

  // Mouse to world
  if (mouse.active) {
    ndc.set(mouse.ndcX, mouse.ndcY)
    raycaster.setFromCamera(ndc, camera)
    raycaster.ray.intersectPlane(plane, mouseWorld)
  }

  if (dispersed) {
    points.position.y = 0
    if (!disperseStarted) {
      disperseStarted = true
      disperseT0 = t
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const s = i * 3
        const dx = positions[s] - centroid.x
        const dy = positions[s + 1] - centroid.y
        const dz = positions[s + 2] - centroid.z
        const len = Math.hypot(dx, dy, dz) || 1
        const speed = DISPERSE_SPEED * (0.6 + Math.random() * 0.8)
        velocities[s] = dx / len * speed + (Math.random() - 0.5) * 0.04
        velocities[s + 1] = dy / len * speed + (Math.random() - 0.5) * 0.04 + 0.03
        velocities[s + 2] = dz / len * speed + (Math.random() - 0.5) * 0.04
      }
    }
    const elapsed = t - disperseT0
    pointsMaterial.opacity = Math.max(0, OPACITY_MAX * (1 - elapsed / DISPERSE_DURATION))
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const s = i * 3
      positions[s] += velocities[s]
      positions[s + 1] += velocities[s + 1]
      positions[s + 2] += velocities[s + 2]
      velocities[s] *= DISPERSE_DAMPING
      velocities[s + 1] *= DISPERSE_DAMPING
      velocities[s + 2] *= DISPERSE_DAMPING
    }
    points.geometry.attributes.position.needsUpdate = true
  } else {
    if (disperseStarted) {
      disperseStarted = false
      pointsMaterial.opacity = OPACITY_MAX
      // Don't teleport - let spring physics pull particles back to source positions
    }
    points.position.y = Math.sin(t * 0.8) * 0.12

    // Spring + mouse repulsion
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const s = i * 3
      const px = positions[s]
      const py = positions[s + 1]
      const pz = positions[s + 2]

      // Spring back to source
      velocities[s] += (sourcePositions[s] - px) * SPRING
      velocities[s + 1] += (sourcePositions[s + 1] - py) * SPRING
      velocities[s + 2] += (sourcePositions[s + 2] - pz) * SPRING

      // Mouse repulsion
      if (mouse.active) {
        const dx = px - mouseWorld.x
        const dy = py - mouseWorld.y
        const dz = pz - mouseWorld.z
        const distSq = dx * dx + dy * dy + dz * dz
        if (distSq < MOUSE_RADIUS * MOUSE_RADIUS) {
          const dist = Math.sqrt(distSq) || 0.001
          const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE
          velocities[s] += dx / dist * force
          velocities[s + 1] += dy / dist * force
          velocities[s + 2] += dz / dist * force
        }
      }

      // Damping
      velocities[s] *= DAMPING
      velocities[s + 1] *= DAMPING
      velocities[s + 2] *= DAMPING

      // Apply velocity
      positions[s] += velocities[s]
      positions[s + 1] += velocities[s + 1]
      positions[s + 2] += velocities[s + 2]
    }
    points.geometry.attributes.position.needsUpdate = true
  }

  // Update shader time
  dotPass.uniforms.uTime.value = t

  composer.render()
}
animate()

// ============================================================
// Chat UI logic
// ============================================================
const heroChat = document.getElementById('hero-chat')
const chatScroll = document.getElementById('chat-scroll')
const chatForm = document.getElementById('chat-form')
const chatInput = document.getElementById('chat-input')
const askForm = document.getElementById('ask-form')
const askInput = document.getElementById('ask-input')
const askSuggestions = document.getElementById('ask-suggestions')
const heroScreenAsk = document.getElementById('hero-screen-ask')
const resetBtn = document.getElementById('reset-btn')

// Render suggestions
SUGGESTIONS.forEach((s) => {
  const btn = document.createElement('button')
  btn.type = 'button'
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('fill', 'currentColor')
  svg.setAttribute('viewBox', '0 0 256 256')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', s.icon)
  svg.appendChild(path)
  btn.appendChild(svg)
  btn.appendChild(document.createTextNode(s.text))
  btn.addEventListener('click', () => submit(s.text))
  askSuggestions.appendChild(btn)
})

function submit(val) {
  const N = val.trim()
  if (!N) return
  messages.push({ id: msgId++, role: 'user', text: N })
  messages.push({ id: msgId++, role: 'assistant', text: '', streaming: true })
  isStreaming = true
  chatActive = true
  dispersed = true
  updateUI()
  renderMessages()
}

function reset() {
  messages = []
  isStreaming = false
  chatActive = false
  dispersed = false
  askInput.value = 'how do I run evals at scale?'
  chatInput.value = ''
  updateUI()
  renderMessages()
}

function updateUI() {
  heroChat.classList.toggle('is-active', chatActive)
  heroScreenAsk.classList.toggle('is-chat-active', chatActive)
  chatForm.classList.toggle('is-thinking', isStreaming)
  askForm.classList.toggle('is-thinking', isStreaming)
  chatInput.disabled = isStreaming
}

function renderMessages() {
  chatScroll.innerHTML = ''
  messages.forEach((msg) => {
    if (msg.role === 'user') {
      const div = document.createElement('div')
      div.className = 'hero-chat-cmd'
      const prompt = document.createElement('span')
      prompt.className = 'hero-chat-prompt'
      prompt.textContent = '/ask'
      const text = document.createElement('span')
      text.textContent = msg.text
      div.appendChild(prompt)
      div.appendChild(text)
      chatScroll.appendChild(div)
    } else {
      const div = document.createElement('div')
      div.className = 'hero-chat-answer'
      if (msg.streaming && msg.text === '') {
        const thinking = document.createElement('span')
        thinking.className = 'hero-chat-thinking'
        thinking.textContent = 'searching Cua docs'
        const dots = document.createElement('span')
        dots.className = 'hero-chat-dots'
        thinking.appendChild(dots)
        div.appendChild(thinking)
      } else {
        const caret = document.createElement('span')
        caret.className = 'hero-chat-caret'
        caret.textContent = '>'
        const out = document.createElement('div')
        out.className = 'hero-chat-out hero-chat-markdown'
        out.textContent = msg.text
        if (msg.streaming) {
          const cursor = document.createElement('span')
          cursor.className = 'hero-chat-cursor'
          out.appendChild(cursor)
        }
        div.appendChild(caret)
        div.appendChild(out)
      }
      chatScroll.appendChild(div)
    }
  })
  chatScroll.scrollTop = chatScroll.scrollHeight
}

// Event listeners
askForm.addEventListener('submit', (e) => {
  e.preventDefault()
  submit(askInput.value)
})

chatForm.addEventListener('submit', (e) => {
  e.preventDefault()
  if (!isStreaming && chatInput.value.trim()) {
    submit(chatInput.value)
    chatInput.value = ''
  }
})

resetBtn.addEventListener('click', reset)
