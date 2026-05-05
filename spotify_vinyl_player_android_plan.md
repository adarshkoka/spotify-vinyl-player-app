# Native Android Music Player: Development Plan

## 1. Project Overview
**Objective:** Develop a native Android music player application in Kotlin that extends the functionality of the existing Spotify Vinyl Player (currently a Vite/React SPA) into a deeply integrated mobile experience. 
**Key Deliverables:** 1. Core native media playback engine.
2. Highly interactive home screen widget with state-driven animations.
3. Full Android Auto compatibility.
4. Proper configuration for local testing using the Desktop Head Unit (DHU).

*Note: This document focuses on architectural goals and component structure. Code implementation and permission configurations are explicitly excluded and will be handled separately.*

---

## 2. Phase 1: Core Media Architecture (Kotlin)
To support both a widget and Android Auto seamlessly, the app must strictly separate the user interface from the audio playback engine.

* **Media Session Management:** Establish a centralized `MediaSession`. This acts as the single source of truth for the playback state (playing, paused, stopped) and metadata (current track, artist, album art).
* **Background Service:** Implement a `MediaBrowserService`. This service will run independently of the main UI, holding the `MediaSession` and managing the actual audio playback. 
* **State Broadcasting:** Create a mechanism for the service to broadcast its state changes so the main app, widget, and Android Auto interfaces stay perfectly in sync.

---

## 3. Phase 2: Interactive Home Screen Widget
The widget must feel like a first-class citizen on the Android home screen, offering direct control without launching the full app.

* **Layout & UI:** Design a responsive layout that scales well across different grid sizes. Maintain the visual aesthetic of the original Spotify Vinyl Player SPA.
* **Direct Interaction:** Map widget buttons (Play, Pause, Next, Previous) to pending intents that communicate directly with the background media service. 
* **State-Driven Animations:** * Link the widget's visual state to the `MediaSession` playback state.
  * Define triggers so that animations (e.g., a spinning vinyl record) *only* begin when the service broadcasts a `STATE_PLAYING` status.
  * Ensure animations gracefully pause or reset when the state shifts to `STATE_PAUSED` or `STATE_STOPPED`.

---

## 4. Phase 3: Android Auto Integration
Android Auto requires exposing the app's media library in a standardized way so the car's head unit can build its own safe-driving interface.

* **Media Hierarchy:** Structure the music library into a browseable tree (e.g., Root -> CoverArt Sleeve Button -> Playlists -> Tracks) that the `MediaBrowserService` can serve to the car's display.
* **Playback Callbacks:** Ensure the `MediaSession` handles transport controls (play, skip, pause) initiated from the car's controls.
* **Metadata Syncing:** Pass the currently playing track's metadata (title, artist, album art) to the `MediaSession` so it renders correctly on the vehicle's dashboard.

---

## 5. Phase 4: DHU (Desktop Head Unit) Testing Setup
To validate the Android Auto integration efficiently without needing a physical vehicle, the app structure must support the DHU emulator.

* **Automotive Descriptor:** Define an `automotive_app_desc.xml` resource file that declares the app's automotive capabilities (specifically, declaring it as a media application).
* **Manifest Meta-data:** Add the required `<meta-data>` tag pointing to the automotive descriptor within the application block of the manifest. This is the critical structural requirement that tells the DHU emulator to recognize and load the service.
* **Export Strategy:** Ensure the `MediaBrowserService` is correctly exported in the application manifest so the external DHU process can successfully bind to it during local testing.
