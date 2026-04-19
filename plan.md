# Project Plan: Spotify Record Player App

**Objective:** Develop a Single Page Application (SPA) that allows users to authenticate with Spotify and fetch their currently playing song. The application be built using Vite, React, and TypeScript, employing the Spotify API Authorization Code with PKCE Flow.

The website will feature a dynamic, interactive "Lofi-style" music visualizer synced with the Spotify Web API. 

Core Functional Requirements:

Dynamic Graphics Engine: Construct a central visual component representing a vinyl record player. The system must programmatically inject the current song's album art onto the center section of the spinning disc.

Bi-Directional Playback Sync: The graphic’s rotation must reflect the real-time playback state (spinning when active, halted when paused).

Controller: The graphic must be a primary interface; clicking/touching the record player should toggle the global playback state (Play/Pause).

Architecture for Future Expansion:

Environmental Layering: The application must utilize a layered rendering approach. The record player should exist as a close-up object within a broader "room" scene, allowing for independent backgrounds to be integrated later.

Component Extensibility: Define the record player as an isolated, modular component with an open event-handling system. This ensures that future physical interactions—like "fast-forward or rewind", or "vinyl swapping" — can be added without refactoring the core rendering logic.

Song Switching Logic (The "Slide & Drop" Sequence):
The application must handle "New Track" events through a multi-stage transition lifecycle rather than a simple image swap:

Stage 1 (The Jacket): Upon a song change, the new album art is rendered as a stationary square "sleeve" or "jacket."

Stage 2 (The Emergence): The circular vinyl disc (containing the same album art as its center label) must programmatically slide out from within the jacket graphic.

Stage 3 (The Placement): The disc must follow a defined motion path to seat itself onto the record player spindle, at which point the rotation and playback synchronization begin.

Structural Requirements for Animation:

Entity Separation: The "Jacket" and the "Disc" must be defined as distinct visual layers to allow for independent translation and rotation.

Z-Index Management: The system must support depth-layering so the disc appears to "emerge" from the interior of the sleeve before moving to the foreground layer of the player.

State-Driven Transitions: Transition triggers must be tied to Spotify’s track_id state. A change in ID should automatically fire the "Eject/Load" sequence, ensuring the visual representation stays in lockstep with the audio stream.