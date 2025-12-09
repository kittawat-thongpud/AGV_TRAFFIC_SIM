# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2025-12-09

### Added

- **Node Limit Increase**: Support for up to 200 nodes with dynamic map sizing.
- **Goal Highlighting**: Visual indicators (pulsing ring and flag) for AGV target nodes.
- **Reservation Priority**: "First Come First Serve" logic based on path planning time.

### Changed

- **Map Centering**: Auto-fit and center map on regeneration.
- **Controls Layout**: Rearranged "Regenerate" and "Random Seed" buttons for better usability.
- **Performance**: Optimized pathfinding (Dijkstra + Constraints) to prevent simulation freezing.

## [0.1.0] - 2025-12-09

### Added

- Initial project setup with React, TypeScript, and Vite.
- Core simulation logic: Map generation, Pathfinding (Dijkstra, K-Shortest), Traffic Manager.
- UI Components: MapCanvas, Sidebar, Controls, Telemetry.
- Interactive map with zoom and pan.
- AGV fleet configuration (Speed, Acceleration, Safety Distance).
- Real-time telemetry for selected AGV.
- Path visualization: Soft Path (dashed) and Borrow Path (solid overlay).
- "Show All Paths" toggle in Sidebar.
- CI/CD workflow for Cloudflare Pages deployment.

### Changed

- Refactored UI layout: Moved Fleet Settings and AGV List to a right-side panel.
- Updated Controls bar to include Map Settings (Seed, Node Count).
- Adjusted path visualization colors for better visibility.
