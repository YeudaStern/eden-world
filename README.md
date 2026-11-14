# 🏡 House of Eden 3D (`eden-world`)
**An Autonomous 3D AI Life Simulation Powered by Gemini, FastAPI & React Three Fiber**

House of Eden is a persistent, stateful 3D life simulation where autonomous AI agents live, think, converse, argue, work, and raise a family inside a two-story interactive villa. Built with a hybrid cognitive architecture, it combines deep LLM reasoning (**Google Gemini**) with a biological state machine, real-time 3D procedural rendering (**Three.js / R3F**), and zero-latency dual-tone Hebrew neural speech synthesis (**Edge-TTS**).

---

## ✨ Key Architectural Features

### 🧠 1. Hybrid Cognitive Engine (LLM + Local Autonomy)
* **Deep AI Cognition (`gemini-3.5-flash-lite`):** Uses Pydantic **Structured Outputs** (`AgentDecision`) to generate internal thoughts, spoken dialogue, physical actions, and relationship deltas based on world state, memories, and partner interactions.
* **Seated AI-to-AI Dialogue & Arguments:** Agents can sit face-to-face on the living room sofa and hold multi-turn, state-aware conversations or heated arguments (`ARGUE` / `TALK`) driven entirely by Gemini context history.
* **Biological Routine Fallback:** A deterministic local state machine handles intermediate ticks (hunger, energy, hygiene, circadian day/night cycles, and once-per-day work shifts), ensuring smooth 24/7 operation without exhausting API rate limits.

### 🔊 2. Atomic Dual-Tone Neural TTS Synchronization
* **Pre-Generated Audio Commits:** Instead of fetching audio on the client after an action occurs, the backend pre-generates MP3 streams via Microsoft Neural TTS (`he-IL-AvriNeural` & `he-IL-HilaNeural`) and embeds them as `Base64` payloads directly inside the state tick.
* **Dual-Tone Vocalization:**
  * 💭 **Internal Thoughts:** Synthesized at a lower pitch and slower cadence (`-10Hz`, `-3%` rate).
  * 🗣️ **Spoken Dialogue:** Synthesized at a brighter, expressive pitch (`+10Hz`, `+9%` rate) with real-time 3D lip-sync.

### 🎨 3. Interactive 3D Two-Story Villa (`@react-three/fiber`)
* **Dynamic Environment:** Real-time day/night skybox, stars, ACES Filmic tone mapping, soft shadows, and procedural PBR wood/marble reflector floors.
* **Rich Interactive Zones:**
  * **Ground Floor:** Living room with a live animated cinema TV, guitar corner, library bookshelf, espresso bar, kitchen with dynamic dishes & steam particles, dining room, laundry machine, and pet corner.
  * **Second Floor:** Master bedroom with animated wardrobe, glass shower with water & soap foam particles, home gym with dumbbells, computer gaming desk, and a nursery with cribs.
  * **Backyard:** Illuminated swimming pool and sun deck with loungers.
* **Proportional Anatomical Rig & Modular Wardrobe:** Multi-layered character meshes supporting real-time outfit switching (`casual`, `formal`, `sport`, `pajamas`, `underwear`, `towel`, `naked`) and custom color swatches.
* **Life Cycle & Pets:** Conception and automatic crib purchase, 3-stage child development (Crib Newborn ➔ Crawling on all fours ➔ Walking Toddler), and animated 3D pets (`Fox.glb`).

### 🎮 4. "God Mode" & Mind Control Dashboard
* **Hebrew Voice & Text Commands:** Direct microphone integration (Web Speech API) and natural language command parsing via Gemini.
* **Thought Implantation (`/implant-thought`):** Inject thoughts directly into an agent's subconscious and watch them translate into immediate physical actions.
* **Cognitive Archives & Memory Editor:** Inspect the full chronological thought history of each agent and add/remove permanent core memories.
* **Persistent World State:** Automatic disk serialization (`world_save.json`) preserves the exact simulation state across server restarts and page reloads.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Three.js, `@react-three/fiber`, `@react-three/drei`, Tailwind CSS, Lucide Icons |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, Pydantic, AsyncIO |
| **AI & Audio** | Google GenAI SDK (`gemini-3.5-flash-lite`), `edge-tts` (Neural Hebrew TTS), Web Speech API |
| **Persistence** | JSON Atomic State Serialization (`world_save.json`) |

---

## 📂 Project Structure

```text
eden-world/
├── backend/
│   ├── main.py            # FastAPI server, async life loop, TTS caching & command endpoints
│   ├── agent_brain.py     # Gemini LLM integration, AI-to-AI dialogue & local biological engine
│   ├── world_state.py     # Spatial coordinates, dish menu, persistence (world_save.json)
│   ├── models.py          # Pydantic schemas (Agent, AgentDecision, ActionType, OutfitStyle)
│   └── .env               # Environment variables (GEMINI_API_KEY - excluded from Git)
└── frontend/
    ├── src/
    │   ├── World3D.tsx    # Three.js / R3F 3D villa, procedural textures & character rigs
    │   ├── App.tsx        # Control dashboard, FIFO audio queue, voice recognition & HUD
    │   └── main.tsx       # React entry point
    ├── package.json
    └── vite.config.ts
```

---

## 🚀 Getting Started

### 1. Prerequisites
* **Python 3.10+**
* **Node.js 18+** & `npm`
* A **Google Gemini API Key** ([Get one from Google AI Studio](https://aistudio.google.com/))

### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn google-genai pydantic python-dotenv edge-tts wikipedia
```

Create a `.env` file inside the `backend/` directory:
```env
GEMINI_API_KEY=your_api_key_here
```

Start the FastAPI server:
```bash
uvicorn main:app --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🕹️ API Endpoints Overview

* `GET /state` — Returns full world state, agent coordinates, quota telemetry, and dual-audio logs.
* `POST /toggle-simulation` — Starts or pauses the autonomous background life loop.
* `POST /command` — Executes natural language voice/text commands or forced actions via Gemini.
* `POST /agents/{agent_id}/implant-thought` — Implants a subconscious thought and triggers immediate AI reaction.
* `POST /start-dialogue` — Seats agents in the living room for a multi-turn AI-to-AI argument or deep conversation.
* `POST /agents/{agent_id}/wardrobe` — Updates agent outfit style and color in real time.
* `POST /agents/{agent_id}/grow` — Advances child developmental stage (Newborn ➔ Crawling ➔ Walking).
* `POST /reset` — Resets world state and clears `world_save.json`.

---

## 👤 Author
**Yehuda Shtern**  
* GitHub: [@YeudaStern](https://github.com/YeudaStern)