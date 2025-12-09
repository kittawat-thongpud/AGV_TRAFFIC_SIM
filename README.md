# AGV Traffic Simulator

A React-based simulation of Automated Guided Vehicles (AGVs) in a warehouse environment. This project visualizes AGV movement, pathfinding, and traffic management using a node-based map system.

## Features

- **Dynamic Map Generation**: Generate random warehouse maps with configurable seed and node count.
- **Pathfinding**: Uses Dijkstra's algorithm and K-Shortest Paths for route planning.
- **Traffic Management**: Implements collision avoidance, node reservation (Hard Borrow), and deadlock detection.
- **Visualizations**:
  - Real-time AGV movement and orientation.
  - Path highlighting (Soft Path).
  - Reservation visualization (Borrow Path).
  - Interactive map with zoom and pan.
- **Fleet Configuration**: Adjust max speed, acceleration, deceleration, and safety distance.
- **Telemetry**: Real-time status monitoring for individual AGVs.

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Cloudflare Pages

## Getting Started

### Prerequisites

- Node.js v20+
- npm

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd AGV_TRAFFIC_SIM
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## Deployment

This project is configured to deploy automatically to Cloudflare Pages via GitHub Actions.

- **Push to `main`**: Triggers a production deployment.
- **Custom Domain**: Configured to `AGV_TRAFFIC_SIM.kittawat.qzz.io`.

## License

MIT
