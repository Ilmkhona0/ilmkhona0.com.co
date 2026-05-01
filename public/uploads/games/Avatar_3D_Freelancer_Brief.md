# 3D Avatar — Freelancer Design Brief

> **For:** Freelance 3D artist/developer designing the visual identity of an AI assistant rendered as a real-time 3D avatar in a web browser.
>
> **Deliverable:** A production-ready 3D avatar that reacts to voice, audio, user interaction, and emotional state — displayed during voice calls, in chat interfaces, and on public landing pages.

---

## 1. What You Are Building

The AI assistant needs a visual identity — a 3D avatar displayed in the browser. This avatar is the "face" of the AI. It appears during voice calls (full-screen), in chat interfaces (as a small animated button), and on public call links (shared with external users).

The avatar must feel **alive**: it reacts to speech (lip-sync), breathes, blinks, responds to clicks with ripple effects, and shifts expression based on emotional context. It is rendered in Three.js directly in the browser — no video, no pre-rendered animation.

**Current state:** A golden metallic sphere with a liquid shader is implemented and working. A particle-based face overlay exists. You are designing the **next generation** — whether that's a refined sphere, a stylized character, an abstract entity, or something entirely new.

---

## 2. Where the Avatar Appears

| Context | Size | Interaction | Duration |
|---------|------|-------------|----------|
| **Voice call (full-screen)** | Fills viewport | Audio-reactive, click ripples, idle animation | Minutes to hours |
| **Public call link** (`/c/:code`) | Fills viewport | Same as voice call — this is what external callers see | Minutes |
| **Chat send button** | 46x46 px | Mini sphere with subtle shader animation | Always visible |
| **Chat background** | Full viewport behind messages | Ambient animation, low opacity | Always visible |

The avatar must work at **all sizes** — from a 46px circle to a full 4K viewport.

---

## 3. Current Implementation (What Exists)

### Golden Sphere
A procedural sphere (radius 1.25, 144 segments) with:
- Gold material (RGB 1.0, 0.766, 0.336), full metalness, roughness 0.18
- Clearcoat layer (0.35) for depth
- Custom liquid displacement shader that ripples in response to audio
- Click-to-ripple interaction (up to 10 simultaneous ripple peaks)
- HDRI environment lighting with bloom post-processing
- Idle rotation and wave animation
- 3 material presets: shiny, matte, ultra-polished

### Particle Face
An animated particle system (~3,600 particles) forming a stylized face:
- Contour, eyes, eyebrows, nose, mouth, cheeks, aura — each a separate particle group
- Cyan-blue color palette
- Lip-sync via mouth particle displacement (driven by audio amplitude)
- Blink animation (170ms, random 1.2-3s interval)
- Breathing animation (gentle vertical oscillation)
- Smile response (eyebrow lift + mouth curve)
- Aura particles orbit the face

### Audio Reactivity (already built)
The shader/particle system receives these audio signals every frame:
- `micEnergy` (0-1) — local microphone amplitude
- `remoteEnergy` (0-1) — remote speaker amplitude
- `mouthLevel` (0-0.24) — speaking intensity for lip-sync
- `smileLevel` (0-0.05) — smile intensity

### Shader Effects (already built, usable for new design)
The liquid shader supports these real-time parameters:
- **Base displacement:** Multi-octave Perlin noise, configurable amplitude and frequency
- **Audio displacement:** Surface bulges in response to sound
- **Click ripples:** Radial waves from click position, up to 10 simultaneous
- **Electromagnetic effects:** Electric field lines, magnetic spirals, polar distortion
- **Fluid dynamics:** Turbulence, crackle, surface interference patterns
- **Idle animation:** 4 breathing/wave patterns for when nothing is happening

---

## 4. Design Direction — What We Want

### Core Requirements

1. **Recognizable identity** — The avatar should be instantly recognizable as "this AI assistant." Not generic, not a human face, not uncanny valley.

2. **Audio-reactive** — The primary animation driver is audio. When the AI speaks, the avatar must visibly respond. When the user speaks, there should be a listening indicator.

3. **Emotional range** — The avatar should be able to express at minimum:
   - Neutral/idle (default resting state)
   - Speaking/active (audio-driven animation)
   - Listening (subtle indicator that it's receiving input)
   - Thinking/processing (waiting for AI response)
   - Happy/positive (after successful interaction)
   - Concerned/empathetic (sensitive topics)

4. **Works at all sizes** — Must look good as a 46px button AND a full-screen background.

5. **Performance** — Must maintain 60fps on mid-range mobile. The avatar runs alongside chat UI and voice processing — it cannot be GPU-heavy.

### Creative Freedom

You have full creative freedom on the visual direction. Some possibilities:

- **Evolved sphere:** Keep the golden sphere but add more character — floating elements, orbital rings, expression through color/intensity shifts, geometric transformations
- **Abstract entity:** A non-human form that conveys intelligence — flowing particles, geometric tessellation, energy field
- **Stylized character:** A low-poly or cel-shaded head/bust — not realistic, but with clear expressions (think Pixar-simple, not photorealistic)
- **Hybrid:** A geometric core with organic particle effects — crystal with living energy inside
- **Morphing form:** Shape-shifts subtly based on emotional state — calm = smooth sphere, excited = spiky, thinking = faceted

**What to avoid:**
- Photorealistic human faces (uncanny valley risk, high GPU cost)
- Generic chatbot faces (must feel unique and premium)
- Static models with no animation (the avatar must feel alive at all times)

---

## 5. Technical Specifications

### Rendering Environment

| Property | Value |
|----------|-------|
| Engine | Three.js (latest) |
| Renderer | WebGL 2.0 with ACES Filmic tone mapping |
| Pixel ratio | 1-3x (device dependent) |
| Post-processing | UnrealBloomPass available (threshold 0.2, strength 0.35, radius 0.4) |
| Camera | Perspective, FOV 35deg, positioned at (0, 0, 5) |
| Lighting | HDR environment map + directional light + ambient |
| Background | Radial gradient (dark brown center → near-black edges) |
| Color space | sRGB output |

### Available Avatar Formats

| Format | Support | Notes |
|--------|---------|-------|
| **Procedural geometry** | Full | Built in code with Three.js primitives + shaders |
| **GLTF/GLB** | Full | Static or animated models, loaded at runtime |
| **VRM** | Full | VR avatar format with blend shapes for expressions |
| **Particle systems** | Full | Point-based systems with custom shaders |

You can use any combination. The system supports **lazy loading** — the 3D bundle (~3MB) is only loaded when the avatar is needed.

### Audio Input (provided to you every frame)

```javascript
// You receive this every animation frame:
{
  micEnergy: 0.0-1.0,       // User microphone level
  remoteEnergy: 0.0-1.0,    // AI voice output level
  mouthLevel: 0.0-0.24,     // Lip sync target (derived from audio)
  smileLevel: 0.0-0.05,     // Smile amount
  dt: 16.67                  // Delta time in ms
}
```

### Emotional State (provided via events)

```javascript
// Emotional context from backend:
this.handleEvent("set_expression", ({expression}) => {
  // expression: "neutral" | "speaking" | "listening" | "thinking" | 
  //             "happy" | "concerned" | "surprised" | "error"
})

// Sentiment from conversation analysis:
this.handleEvent("set_sentiment", ({sentiment}) => {
  // sentiment: "positive" | "neutral" | "negative"
})
```

### Interactive Controls (already implemented)

| Interaction | Effect | Notes |
|-------------|--------|-------|
| Mouse drag | Rotate avatar | Sensitivity configurable |
| Scroll wheel | Zoom in/out | Sensitivity configurable |
| Click/tap | Ripple effect at click point | Up to 10 simultaneous ripples, 8s decay |
| Double-click | Reset camera | Returns to default view |
| Pinch (mobile) | Zoom | Standard pinch-to-zoom |

### Performance Budget

| Target | Value |
|--------|-------|
| FPS | 60fps on mid-range mobile (iPhone 12 / Pixel 6 class) |
| Triangle count | < 10K for the avatar itself |
| Texture memory | < 8MB total |
| Draw calls | < 20 per frame |
| GPU time | < 4ms per frame (leaving headroom for UI + audio processing) |

---

## 6. Deliverables

### Required

1. **Avatar model/system** — The 3D avatar in whatever format you choose (procedural, GLTF, particles, hybrid)
2. **Animation system** — How the avatar responds to: audio, emotions, idle state, interactions
3. **Expression maps** — How each emotional state maps to visual changes (color, shape, animation, particle behavior)
4. **Size adaptation** — How the avatar scales from 46px to full-screen
5. **Material/shader definitions** — If using custom shaders, provide documented GLSL

### Nice to Have

- Multiple visual variants (e.g., light theme / dark theme)
- Seasonal or contextual appearance changes
- Transition animations between emotional states
- "Boot up" animation for when the avatar first appears
- "Shutdown" animation for when a call ends

### Delivery Format

- Three.js compatible code (ES modules)
- GLTF/GLB models if applicable
- Shader files (GLSL) if applicable
- Documentation of all tunable parameters
- Performance profiling results on at least 2 devices

---

## 7. Integration Points

### How Your Code Connects

```javascript
// Your avatar is initialized by the existing hook system:
// You provide a module that exports:

export default {
  // Called once when the avatar container mounts
  init(canvas, options) {
    // options.mini: boolean (46px vs fullscreen)
    // options.avatarSrc: optional GLB/VRM path
    // Returns: your avatar instance
  },

  // Called every animation frame (~60fps)
  update(dt, audioData) {
    // dt: delta time in ms
    // audioData: {micEnergy, remoteEnergy, mouthLevel, smileLevel}
  },

  // Called when emotional state changes
  setExpression(expression) {
    // expression: "neutral" | "speaking" | "listening" | "thinking" | ...
  },

  // Called when user clicks/taps the avatar
  onClick(x, y) {
    // Normalized coordinates (0-1)
  },

  // Called when container resizes
  resize(width, height) {},

  // Called when avatar is removed
  destroy() {}
}
```

### What You Can Use

All existing shader infrastructure is available:
- Liquid displacement shader (audio-reactive surface deformation)
- Click ripple system (radial waves)
- Electromagnetic effect system (electric fields, magnetic lines)
- Bloom post-processing
- HDR environment maps
- Particle system framework

You are free to replace, extend, or build on top of any of these.

---

## 8. Reference & Inspiration

### Current look (golden sphere)
- Metallic gold sphere with subtle liquid surface movement
- Bloom glow around edges
- Ripples spread from click points
- Surface displacement follows audio amplitude
- Dark gradient background (brown → black)

### Aspirational references (for inspiration, not to copy)
- Apple Siri sphere animation (fluid, responsive, minimal)
- OpenAI voice mode visualization (abstract, pulsing)
- Samantha from "Her" (warm, present, non-visual but emotionally clear)
- Destiny 2 Ghost (geometric, characterful, small but expressive)
- Iron Man JARVIS/FRIDAY UI (holographic, technical, alive)

The goal is something **unique** that doesn't look like any existing AI assistant. Premium, alive, recognizable.

---

## 9. Missing Data Points?

If your design would benefit from data we don't currently provide, **tell us**. We can add:
- Real-time typing speed (how fast the AI is generating text)
- Token count (how complex the current response is)
- Confidence level (how certain the AI is about its answer)
- Tool usage state (the AI is searching the web, reading email, etc.)
- Conversation turn count (how long the conversation has been going)
- Background noise level (is the user in a quiet or noisy environment)
- Any other signal that would make the avatar more expressive

The backend is flexible. Your creative ideas drive what data we expose.

---

## 10. Acceptance Criteria

- [ ] Avatar renders at 60fps on mid-range mobile device
- [ ] Audio reactivity is immediately visible (< 50ms latency from audio to visual)
- [ ] At least 6 distinguishable emotional expressions
- [ ] Looks good at 46x46px (mini) AND full viewport (4K)
- [ ] Idle animation runs smoothly when no audio input
- [ ] Click/tap interaction produces visible feedback
- [ ] No uncanny valley — the avatar should feel like an AI, not a failed human
- [ ] Works in all major browsers (Chrome, Safari, Firefox, Edge)
- [ ] Total GPU memory < 8MB
- [ ] Boot-up time < 2 seconds on first load
