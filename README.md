# XPLOITX CTF — DOOMSDAY PROTOCOL LAUNCH EXPERIENCE

A futuristic, highly cinematic launch portal for **XPLOITX CTF**, built with pure **HTML5, CSS3, and Vanilla JavaScript (ES6+)**.

---

## 📁 Directory Structure

```
/
├── index.html            # Main HTML5 entry point & markup structure
├── assets/               # Image assets (favicon.svg, hero.png, icons.svg)
├── css/
│   ├── style.css         # Modern CSS3 layout, glassmorphism, responsive grid & HUD styling
│   └── animations.css    # CRT scanlines, light sweeps, pulse glow & glitch keyframes
├── js/
│   ├── main.js           # Master 14-step sequence state machine & event handling
│   ├── cores.js          # Three-core state manager (core1, core2, core3 booleans)
│   ├── animations.js     # HTML5 Canvas renderers (Background grid/particles, Lasers, Doomsday Battle)
│   └── audio.js          # Centralized Web Audio API Sound Engine (SFX & audio toggle)
└── README.md
```

---

## ⚡ Key Features

1. **Three Core Reactor Activation System**: Interactive buttons (`CORE 01`, `CORE 02`, `CORE 03`) with individual state locking and energy gauges.
2. **14-Step Sequential State Machine**: Strictly enforces the sequence from core activations to laser convergence, portal breach, 2D fighter combat, and final redirect.
3. **Pure Canvas Animations**:
   - `bg-canvas`: Ambient floating digital particles and scanning light bar.
   - `laser-canvas`: Inter-core plasma connections, rising vertical lasers, and energy sphere convergence.
   - `battle-canvas`: Apocalyptic Doomsday city skyline and 2D fighter choreography (XPLOITX vs. Doomsday Guardian).
4. **Web Audio API Sound Engine**: Zero external audio dependencies—all sci-fi sound effects are synthesized programmatically in real-time.
5. **No Build Dependencies**: Run directly with any standard static HTTP server (e.g. VS Code Live Server, python `-m http.server`, `npx serve`, etc.).

---

## 🚀 How to Run

Serve `index.html` using any local HTTP server:

```bash
# Using Python
python -m http.server 8080

# Or using Node static server
npx serve .
```

Open `http://localhost:8080` in your web browser.
