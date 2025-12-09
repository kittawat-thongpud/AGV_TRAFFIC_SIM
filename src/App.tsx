import React, { useState, useEffect, useRef } from 'react';
import MapCanvas from './components/MapCanvas';
import Sidebar from './components/Sidebar';
import Controls from './components/Controls';
import Telemetry from './components/Telemetry';
import TutorialCard from './components/TutorialCard';
import { generateMapData } from './lib/mapGenerator';
import { useSimulation } from './hooks/useSimulation';
import { ViewTransform, FleetConfig } from './types';

function App() {
  // --- Map State ---
  const [seed, setSeed] = useState("Warehouse-1");
  const [nodeCount, setNodeCount] = useState(50);
  const [mapData, setMapData] = useState(() => generateMapData("Warehouse-1", 14));

  // --- Viewport State ---
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showAllPaths, setShowAllPaths] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // --- Center Map Logic ---
  const centerMap = () => {
      if (mapContainerRef.current && mapData.nodes.length > 0) {
          const containerWidth = mapContainerRef.current.clientWidth;
          const containerHeight = mapContainerRef.current.clientHeight;

          // Calculate map bounds
          const xs = mapData.nodes.map(n => n.x);
          const ys = mapData.nodes.map(n => n.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const mapWidth = maxX - minX;
          const mapHeight = maxY - minY;
          const mapCenterX = minX + mapWidth / 2;
          const mapCenterY = minY + mapHeight / 2;

          // Auto-fit if map is larger than container
          const padding = 50;
          const scaleX = (containerWidth - padding * 2) / mapWidth;
          const scaleY = (containerHeight - padding * 2) / mapHeight;
          // Use a slightly lower max scale to avoid being too zoomed in on small maps
          const k = Math.min(1.2, Math.min(scaleX, scaleY)); 
          
          const x = (containerWidth / 2) - (mapCenterX * k);
          const y = (containerHeight / 2) - (mapCenterY * k);

          setViewTransform({ x, y, k });
      }
  };

  // --- Center Map Effect ---
  useEffect(() => {
      centerMap();
  }, [mapData, mapContainerRef.current?.clientWidth, mapContainerRef.current?.clientHeight]);

  // --- Simulation Hook ---
  const initialFleetConfig: FleetConfig = {
    maxSpeed: 1.4,
    acceleration: 0.1,
    deceleration: 0.15,
    safetyDistance: 35,
    hardBorrowLength: 1,
  };

  const {
    agvs,
    setAgvs,
    isPlaying,
    setIsPlaying,
    randomMoveMode,
    setRandomMoveMode,
    selectedAgvId,
    setSelectedAgvId,
    fleetConfig,
    setFleetConfig,
    spawnAgv,
    setAgvTarget
  } = useSimulation(mapData, initialFleetConfig);

  // --- Handlers ---

  const handleRegenerateMap = () => {
    setIsPlaying(false);
    setAgvs([]);
    setSelectedAgvId(null);
    setMapData(generateMapData(seed, nodeCount));
    // View transform reset handled by useEffect on mapData change
  };

  const handleRandomizeSeed = () => {
    const newSeed = "Map-" + Math.floor(Math.random() * 10000);
    setSeed(newSeed);
    setIsPlaying(false);
    setAgvs([]);
    setSelectedAgvId(null);
    setMapData(generateMapData(newSeed, nodeCount));
    // View transform reset handled by useEffect on mapData change
  };

  const handleConfigChange = (key: keyof FleetConfig, value: number) => {
    // Update global config
    setFleetConfig(prev => ({ ...prev, [key]: value }));
    
    // Update selected AGV if any
    if (selectedAgvId) {
        setAgvs(prev => prev.map(agv => {
            if (agv.id === selectedAgvId) {
                return { ...agv, [key]: value };
            }
            return agv;
        }));
    }
  };

  // --- Zoom / Pan Handlers ---
  const handleWheel = (e: React.WheelEvent) => {
    const scaleSensitivity = 0.001;
    const delta = -e.deltaY * scaleSensitivity;
    const newScale = Math.min(Math.max(0.2, viewTransform.k + delta), 5);

    // Zoom towards center (simplified) or mouse position if we had ref to container rect
    // For now, simple zoom
    // To do proper mouse-centered zoom, we need the rect of the container.
    // Since MapCanvas handles the event, we can pass logic there or accept it's simple here.
    // Let's try to improve it by just scaling for now, or we can use a ref in MapCanvas and pass rect up?
    // Simplified: Zoom center of screen
    // Better: We can just update scale and let user pan.
    
    // Actually, let's just update scale.
    setViewTransform(prev => ({ ...prev, k: newScale }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
        setViewTransform(prev => ({
            ...prev,
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
      centerMap();
  };

  const handleNodeClick = (nodeId: string) => {
      if (selectedAgvId) {
          setAgvTarget(selectedAgvId, nodeId);
      }
  };

  // Derived state for Sidebar
  const selectedAgv = agvs.find(a => a.id === selectedAgvId);
  const currentConfigDisplay = selectedAgv ? {
      maxSpeed: selectedAgv.maxSpeed,
      acceleration: selectedAgv.acceleration,
      deceleration: selectedAgv.deceleration,
      safetyDistance: selectedAgv.safetyDistance,
      hardBorrowLength: selectedAgv.hardBorrowLength
  } : fleetConfig;

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-white overflow-hidden font-sans">

      
      <div ref={mapContainerRef} className="flex-1 relative flex flex-col">
        <TutorialCard />
        <MapCanvas 
            mapData={mapData}
            agvs={agvs}
            viewTransform={viewTransform}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            selectedAgvId={selectedAgvId}
            onSelectAgv={setSelectedAgvId}
            showAllPaths={showAllPaths}
            onNodeClick={handleNodeClick}
        />

        <Controls 
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSpawnAgv={spawnAgv}
            onRegenerateMap={handleRegenerateMap}
            onRandomizeSeed={handleRandomizeSeed}
            randomMoveMode={randomMoveMode}
            onToggleRandomMove={() => setRandomMoveMode(!randomMoveMode)}
            onResetView={handleResetView}
            seed={seed}
            onSeedChange={setSeed}
            nodeCount={nodeCount}
            onNodeCountChange={setNodeCount}
        />

        {/* Right Panel */}
        <div className="absolute top-4 right-4 w-80 flex flex-col gap-4 max-h-[calc(100vh-2rem)]">
            <Telemetry agv={selectedAgv || null} />
            
            <div className="bg-gray-800/90 backdrop-blur border border-gray-700 rounded-xl overflow-hidden flex flex-col shadow-xl flex-1 min-h-0">
                <Sidebar 
                    config={currentConfigDisplay} 
                    onConfigChange={handleConfigChange}
                    selectedAgvId={selectedAgvId}
                    agvs={agvs}
                    onSelectAgv={setSelectedAgvId}
                    showAllPaths={showAllPaths}
                    onToggleShowAllPaths={() => setShowAllPaths(!showAllPaths)}
                />
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;
