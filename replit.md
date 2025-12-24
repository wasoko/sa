# Overview

This is a WebGPU-powered web application that computes cosine similarity between vector embeddings using GPU compute shaders and visualizes the results as an interactive 3D graph using Three.js. The application features a React-based sidebar for configuration, supports multiple embedding models via HuggingFace, and includes local IndexedDB storage for persistent data management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Technology Stack**: TypeScript + Vite + React 19 + Three.js
- **Build System**: Vite with React plugin for fast development and HMR (Hot Module Replacement)
- **UI Framework**: React 19 with functional components and hooks
- **Styling**: Tailwind CSS 4 with custom CSS overlay for absolute-positioned HUD elements
- **3D Rendering**: Three.js for WebGL-based graph visualization with camera controls and lighting

**Key Design Decisions**:
- **Module System**: ESNext modules with Vite bundler for optimal tree-shaking
- **Type Safety**: Strict TypeScript configuration with isolated modules
- **Component Structure**: Separation between visualization canvas (`main.ts`) and configuration sidebar (`sidebar.tsx`)
- **Progressive Enhancement**: Graceful fallback to CPU computation when WebGPU is unavailable

## GPU Compute Architecture

**WebGPU Compute Pipeline**:
- **Problem**: Computing cosine similarity for large datasets (n×n matrix) is computationally expensive
- **Solution**: Leverage WebGPU compute shaders for parallel GPU computation
- **Batch Processing**: Processes similarity calculations in configurable batches to manage memory and provide progress feedback
- **Pre-normalization**: Vector norms computed on CPU once, then reused in GPU shader to optimize performance

**Alternatives Considered**: 
- Pure CPU computation (implemented as fallback)
- WebGL compute (rejected in favor of modern WebGPU API)

**Pros**: 10-100x speedup for large datasets, real-time progress reporting
**Cons**: Browser compatibility limited to Chromium 113+, requires WebGPU flags in some browsers

## Data Storage Solutions

**IndexedDB via Dexie.js**:
- **Database Schema**: Multi-table design for tags, vectors, embeddings, and binary data
- **Tables**:
  - `tree`: Key-value configuration store (model selection, credentials)
  - `tags`: Tag entities with references, timestamps, and relationships
  - `vecs`: Vector embeddings keyed by tag ID and model name
  - `refs`: Bookmark/history/tab references with metadata
  - `bins`: Compressed binary data storage with CBOR+gzip encoding
  - `stat`: Tag-level statistics and metadata

**Rationale**: 
- No backend required for local-first operation
- Dexie provides Promise-based API over IndexedDB's complex cursor interface
- Compound indexes support efficient querying (`[ref+type]`, `[tid+mdl]`, `[tid+key]`)

**Data Compression**: 
- Binary data compressed using pako (gzip) and serialized with CBOR for efficient storage
- Helper function `binPut()` automatically compresses before IndexedDB insertion

## Visualization Architecture

**Three.js Scene Graph**:
- **Node Representation**: Dynamically generated mesh geometries positioned in 3D space
- **Edge Rendering**: Line geometries connecting nodes based on similarity threshold
- **Camera System**: Perspective camera with configurable FOV and position
- **Lighting**: Ambient + directional light setup for depth perception

**Celestial Grid Feature** (`tw.tsx`):
- Spherical coordinate grid system for advanced visualization
- Meridian and parallel line construction using trigonometric projections
- Highlighted spherical rectangles for region selection

## State Management

**React State Pattern**:
- Local component state via `useState` for UI interactions
- `useEffect` hooks for data fetching from IndexedDB on mount
- No global state library - simple prop drilling for configuration data

**Configuration Persistence**:
- User settings stored in `tree` table (IndexedDB)
- Merged with `DEF_TREE` defaults on application load
- Real-time synchronization between UI inputs and database

# External Dependencies

## Third-Party Libraries

**Core Dependencies**:
- **Three.js** (0.170.0): WebGL 3D rendering engine for graph visualization
- **React + React-DOM** (19.1.1): UI framework for sidebar and controls
- **Dexie** (3.2.7): IndexedDB wrapper for client-side database operations
- **cbor-x** (1.6.0): Compact Binary Object Representation for efficient serialization
- **pako** (2.1.0): Gzip compression/decompression library

**UI/UX Libraries**:
- **lucide-react** (0.548.0): Icon components for sidebar interface
- **Tailwind CSS** (4.1.16): Utility-first CSS framework with Vite plugin

**Development Tools**:
- **Vite** (7.1.12): Build tool and dev server with native ESM support
- **TypeScript** (5.9.3): Type checking and compilation
- **esbuild** (0.24.0): Fast JavaScript bundler (used by Vite)

## External APIs & Services

**HuggingFace Models**:
- **Purpose**: Embedding model selection for text-to-vector conversion
- **Models Supported**: 14+ pre-trained transformer models for multilingual and English embeddings
- **Default**: `Xenova/bge-small-zh-v1.5` (Chinese-optimized embeddings)
- **Integration Pattern**: Model identifiers stored in configuration, actual inference logic not present in current codebase (prepared for future implementation)

**Supabase (Prepared)**:
- **Configuration**: Credential storage structure in `DEF_TREE` (`"cred": "https://PROJECTID.supabase.co|anon"`)
- **Status**: Infrastructure prepared but not actively used in current implementation
- **Intended Use**: Backend storage/sync for embeddings and tags

## Browser APIs

**WebGPU API**:
- **Critical Dependency**: `navigator.gpu` for compute shader execution
- **Fallback**: CPU-based similarity computation when unavailable
- **Buffer Management**: Manual GPU memory management with buffer creation and data transfer

**Chrome Extension APIs** (Conditional):
- **chrome.runtime.onMessage**: Message passing for cross-context communication
- **chrome.storage.session**: Session-level state persistence
- **Note**: Extension APIs only active in Chrome extension context, gracefully absent in web context

## Development Environment

**Server Configuration** (Vite):
- **Host**: 0.0.0.0 (accessible from network)
- **Port**: 5000 (strict port enforcement)
- **HMR**: WebSocket protocol (wss://) over port 443 for secure hot reload
- **Preview Mode**: Same configuration for production preview builds