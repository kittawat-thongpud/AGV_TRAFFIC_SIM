import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Plus, RotateCcw, MapPin, Navigation, Truck, Settings, AlertTriangle, ArrowRightLeft, ShieldAlert, RefreshCw, Dice5, Gauge, Sliders, ChevronDown, ChevronUp, Shuffle, ZoomIn, Move } from 'lucide-react';

/**
 * AGV Traffic Simulation App v4.1
 * * Features:
 * - NEW: Configurable Hard Path Borrow Length
 * - Two-Level Path Planning (Rough + Hard Path Borrow/Reservation)
 * - Refined Node Entry Control (Closest AGV to Target Node gets priority queue)
 * - "Step Back" Deadlock Resolution (Reverses if blocked by waiting AGV)
 * - Directional Sensors (Front/Back differentiation)
 * - Multi-Attempt Redirection Strategy (Ranked Paths)
 * - UI Refresh: Map Control Bar (Seed/Nodes/Regen)
 * - Advanced Traffic Management & Deadlock Resolution
 * - Physics Engine (Speed, Accel, Decel)
 * - Map Canvas: Zoom & Pan Support
 */

// --- Constants & Map Data ---
const NODE_RADIUS = 15;
const RETRY_INTERVAL = 60; // 1 second (approx 60 frames)
const MAX_RETRIES_PER_RANK = 3;
// RESERVATION_LENGTH is now dynamic in AGV state/config

// --- Random Number Generator (Seeded) ---
const mulberry32 = (a) => {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const stringToSeed = (str) => {
    let hash = 0, i, chr;
    if (str.length === 0) return hash;
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; 
    }
    return Math.abs(hash);
};

// --- Map Generator ---
const generateMapData = (seedStr, numNodes = 14) => {
    const seed = stringToSeed(seedStr);
    const random = mulberry32(seed);
    
    const width = 800;
    const height = 600;
    const padding = 50;
    
    const nodes = [];
    const edges = [];
    const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    // 1. Generate Nodes
    let attempts = 0;
    while (nodes.length < numNodes && attempts < 2000) {
        attempts++;
        const x = padding + random() * (width - 2 * padding);
        const y = padding + random() * (height - 2 * padding);
        
        let tooClose = false;
        for (const node of nodes) {
            const dist = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
            if (dist < 80) { 
                tooClose = true;
                break;
            }
        }
        
        if (!tooClose) {
            const labelIndex = nodes.length;
            const char = labels[labelIndex % labels.length];
            const suffix = Math.floor(labelIndex / 26) || "";
            const id = char + suffix;
            
            nodes.push({ 
                id, 
                x: Math.round(x), 
                y: Math.round(y), 
                label: `Loc ${id}` 
            });
        }
    }

    // 2. Generate Edges
    const processedPairs = new Set();
    
    nodes.forEach((nodeA, i) => {
        const distances = nodes
            .map((nodeB, j) => {
                if (i === j) return null;
                const dist = Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2));
                return { node: nodeB, dist, id: nodeB.id };
            })
            .filter(Boolean)
            .sort((a, b) => a.dist - b.dist);

        const baseConnections = numNodes > 20 ? 2 : 2;
        const extraConnection = random() > 0.6 ? 1 : 0;
        const connections = baseConnections + extraConnection;
        
        for (let k = 0; k < Math.min(connections, distances.length); k++) {
            const target = distances[k];
            const pairId = [nodeA.id, target.id].sort().join('-');
            
            if (!processedPairs.has(pairId)) {
                const costFactor = 0.8 + (random() * 1.2);
                const weight = Math.round(target.dist * costFactor);
                
                edges.push({
                    source: nodeA.id,
                    target: target.id,
                    weight: weight
                });
                processedPairs.add(pairId);
            }
        }
    });

    return { nodes, edges };
};

// --- Algorithms ---

const buildGraph = (nodes, edges) => {
  const graph = {};
  nodes.forEach(node => graph[node.id] = []);
  edges.forEach(edge => {
    graph[edge.source].push({ node: edge.target, weight: edge.weight });
    graph[edge.target].push({ node: edge.source, weight: edge.weight });
  });
  return graph;
};

const findPath = (startNodeId, targetNodeId, graph, avoidNodes = [], avoidEdges = []) => {
  const distances = {};
  const previous = {};
  const queue = [];

  for (const node in graph) {
    distances[node] = Infinity;
    previous[node] = null;
    queue.push(node);
  }
  distances[startNodeId] = 0;

  while (queue.length > 0) {
    queue.sort((a, b) => distances[a] - distances[b]);
    const u = queue.shift();

    if (u === targetNodeId) break;
    if (distances[u] === Infinity) break;

    for (const neighbor of graph[u]) {
      if (avoidNodes.includes(neighbor.node)) continue;

      const isEdgeAvoided = avoidEdges.some(edge => 
        (edge.u === u && edge.v === neighbor.node) || 
        (edge.u === neighbor.node && edge.v === u)
      );
      if (isEdgeAvoided) continue;

      const alt = distances[u] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = u;
      }
    }
  }

  const path = [];
  let u = targetNodeId;
  if (previous[u] !== null || u === startNodeId) {
    while (u !== null) {
      path.unshift(u);
      u = previous[u];
    }
  }
  
  return path.length > 0 ? path.slice(1) : []; 
};

// Find K-Shortest simple paths (Ranked)
const findAllPaths = (startNodeId, targetNodeId, graph, avoidNodes = [], avoidEdges = [], limit = 10) => {
    let results = [];
    
    // DFS approach to find simple paths
    const dfs = (current, path, cost) => {
        if (results.length >= limit) return; // Limit search

        if (current === targetNodeId) {
            results.push({ path: path.slice(1), cost }); // slice(1) to remove start node
            return;
        }

        const neighbors = graph[current];
        // Sort neighbors by weight to explore promising paths first
        neighbors.sort((a, b) => a.weight - b.weight);

        for (const neighbor of neighbors) {
            if (path.includes(neighbor.node)) continue; // Prevent cycles
            if (avoidNodes.includes(neighbor.node)) continue;
            
            const isEdgeAvoided = avoidEdges.some(edge => 
                (edge.u === current && edge.v === neighbor.node) || 
                (edge.u === neighbor.node && edge.v === current)
            );
            if (isEdgeAvoided) continue;

            dfs(neighbor.node, [...path, neighbor.node], cost + neighbor.weight);
        }
    };

    dfs(startNodeId, [startNodeId], 0);
    return results.sort((a, b) => a.cost - b.cost); // Sort by cost
};

// --- Main Component ---

export default function TrafficSimulationApp() {
  const [seed, setSeed] = useState("Warehouse-1");
  const [nodeCount, setNodeCount] = useState(14);
  const [mapData, setMapData] = useState(() => generateMapData("Warehouse-1", 14));
  
  const [agvs, setAgvs] = useState([]);
  const [selectedAgvId, setSelectedAgvId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const [randomMoveMode, setRandomMoveMode] = useState(false);
  
  // Viewport / Zoom State
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgContainerRef = useRef(null);

  // Default Fleet Configuration
  const [defaultFleetConfig, setDefaultFleetConfig] = useState({
    maxSpeed: 3.5,
    acceleration: 0.1,
    deceleration: 0.15,
    safetyDistance: 35,
    hardBorrowLength: 3, // NEW: Configurable reservation length
  });

  const graph = useMemo(() => buildGraph(mapData.nodes, mapData.edges), [mapData]);
  const selectedAgvData = agvs.find(a => a.id === selectedAgvId);
  const activeConfig = selectedAgvData ? {
      maxSpeed: selectedAgvData.maxSpeed,
      acceleration: selectedAgvData.acceleration,
      deceleration: selectedAgvData.deceleration,
      safetyDistance: selectedAgvData.safetyDistance,
      hardBorrowLength: selectedAgvData.hardBorrowLength
  } : defaultFleetConfig;

  // --- Handlers ---

  const handleConfigChange = (key, value) => {
      const numValue = parseFloat(value);
      if (selectedAgvId) {
          setAgvs(prev => prev.map(agv => {
              if (agv.id === selectedAgvId) {
                  return { ...agv, [key]: numValue };
              }
              return agv;
          }));
      } else {
          setDefaultFleetConfig(prev => ({ ...prev, [key]: numValue }));
      }
  };

  const regenerateMap = () => {
    setIsPlaying(false);
    setAgvs([]);
    setSelectedAgvId(null);
    setMapData(generateMapData(seed, nodeCount));
    setViewTransform({ x: 0, y: 0, k: 1 }); // Reset view
  };

  const randomizeSeed = () => {
    const newSeed = "Map-" + Math.floor(Math.random() * 10000);
    setSeed(newSeed);
    setIsPlaying(false);
    setAgvs([]);
    setSelectedAgvId(null);
    setMapData(generateMapData(newSeed, nodeCount));
    setViewTransform({ x: 0, y: 0, k: 1 }); // Reset view
  };

  // --- Map Interaction Handlers ---

  const handleWheel = (e) => {
    if (!svgContainerRef.current) return;
    
    const scaleSensitivity = 0.001;
    const delta = -e.deltaY * scaleSensitivity;
    const newScale = Math.min(Math.max(0.2, viewTransform.k + delta), 5); // Limit zoom 0.2x to 5x

    const rect = svgContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - (mouseX - viewTransform.x) * (newScale / viewTransform.k);
    const newY = mouseY - (mouseY - viewTransform.y) * (newScale / viewTransform.k);

    setViewTransform({ x: newX, y: newY, k: newScale });
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left click
        setIsDragging(true);
        setDragStart({ x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y });
    }
  };

  const handleMouseMove = (e) => {
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

  // --- TRAFFIC MANAGER LOGIC ---
  const checkTrafficRules = (currentAgv, allAgvs, currentNodeObj, nextNodeObj) => {
    let action = 'MOVE'; 
    let conflictReason = null;
    let avoidData = null;
    let blockerId = null;

    // --- Hard Path Borrow Check (Level 2 Planning) ---
    // Check if my immediate next node (myNext) is reserved by someone else.
    if (currentAgv.progress < 0.05 && currentAgv.path.length > 0) {
        const myNextNode = currentAgv.path[0];
        const reservingAgv = allAgvs.find(other => 
            other.id !== currentAgv.id && 
            other.reservedNodes && 
            other.reservedNodes.includes(myNextNode)
        );

        if (reservingAgv) {
            // Found a higher priority reservation (someone claimed it first)
             action = 'WAIT';
             conflictReason = `Node ${myNextNode} Reserved`;
             blockerId = reservingAgv.id;
             return { action, conflictReason, avoidData, blockerId };
        }
    }
    // --------------------------------------------------

    for (const other of allAgvs) {
      if (other.id === currentAgv.id) continue;
      
      const myCurrent = currentAgv.currentNode;
      const myNext = currentAgv.path[0];
      const otherCurrent = other.currentNode;
      const otherNext = other.path[0];

      // 1. Head-On Collision Prevention
      if (myNext === otherCurrent && otherNext === myCurrent) {
         action = 'REPATH_HEAD_ON';
         avoidData = { type: 'edge', u: myCurrent, v: myNext };
         conflictReason = `Head-on w/ AGV-${other.id.toString().slice(-4)}`;
         blockerId = other.id;
         break;
      }

      // 2. "Borrow Path Blocked" (Node Entry Safety/Queueing)
      if (currentAgv.progress < 0.05) { 
          // Conflict A: Destination is already occupied by a stationary AGV
          if (otherCurrent === myNext && other.progress < 0.05) { 
             action = 'WAIT';
             conflictReason = `Dest ${myNext} Occupied`;
             blockerId = other.id;
             break;
          }
          
          // Conflict B: Destination Contention (Multiple AGVs targeting same node - Closer goes first)
          if (otherNext === myNext) {
              const myDist = Math.sqrt(Math.pow(nextNodeObj.x - currentAgv.x, 2) + Math.pow(nextNodeObj.y - currentAgv.y, 2));
              const otherDist = Math.sqrt(Math.pow(nextNodeObj.x - other.x, 2) + Math.pow(nextNodeObj.y - other.y, 2));
              
              // Priority Rule: Closer AGV gets the node.
              if (otherDist < myDist || (Math.abs(otherDist - myDist) < 5 && other.id < currentAgv.id)) {
                  action = 'WAIT';
                  conflictReason = `Yield Entry to ${myNext} (Queue)`;
                  blockerId = other.id;
                  break;
              }
          }
      }

      // 3. Node Occupied (Standard Check for Moving AGVs)
      if (myNext === otherCurrent) {
          const distToOther = Math.sqrt(Math.pow(currentNodeObj.x - other.x, 2) + Math.pow(currentNodeObj.y - other.y, 2));
          if (distToOther < 60) {
             action = 'WAIT';
             conflictReason = `Waiting Node ${myNext}`;
             blockerId = other.id;
             break;
          }
      }

      // 4. Merge Priority (Mid-Edge Conflict)
      if (myNext === otherNext && currentAgv.progress >= 0.05) {
          const myDist = Math.sqrt(Math.pow(nextNodeObj.x - currentAgv.x, 2) + Math.pow(nextNodeObj.y - currentAgv.y, 2));
          const otherDist = Math.sqrt(Math.pow(nextNodeObj.x - other.x, 2) + Math.pow(nextNodeObj.y - other.y, 2));
          
          if (myDist > otherDist + 15) { 
              action = 'WAIT';
              conflictReason = `Merge Yield`;
              blockerId = other.id;
              break;
          }
      }

      // 5. Directional Proximity (Front/Back Sensor)
      const physDist = Math.sqrt(Math.pow(currentAgv.x - other.x, 2) + Math.pow(currentAgv.y - other.y, 2));
      
      if (physDist < currentAgv.safetyDistance) {
          const dx = nextNodeObj.x - currentNodeObj.x;
          const dy = nextNodeObj.y - currentNodeObj.y;
          const headingAngle = Math.atan2(dy, dx);

          const otherDx = other.x - currentAgv.x;
          const otherDy = other.y - currentAgv.y;
          const angleToOther = Math.atan2(otherDy, otherDx);

          let diff = angleToOther - headingAngle;
          while (diff > Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          
          const isObstacleInFront = Math.abs(diff) < Math.PI / 2;

          if (isObstacleInFront) {
              const totalDist = Math.sqrt(dx*dx + dy*dy);
              const moveX = (dx / totalDist) * currentAgv.currentSpeed;
              const moveY = (dy / totalDist) * currentAgv.currentSpeed;
              const futureX = currentAgv.x + moveX;
              const futureY = currentAgv.y + moveY;
              const futureDist = Math.sqrt(Math.pow(futureX - other.x, 2) + Math.pow(futureY - other.y, 2));

              if (futureDist < physDist) {
                  action = 'WAIT';
                  conflictReason = 'Front Sensor: Stop';
                  blockerId = other.id;
                  break;
              }
          }
      }
    }

    return { action, conflictReason, avoidData, blockerId };
  };

  // Animation Loop
  useEffect(() => {
    let animationFrameId;

    const updateSimulation = () => {
      if (!isPlaying) return;

      setAgvs(prevAgvs => {
        return prevAgvs.map(agv => {
          
          // Random Move Logic (Auto-Pilot)
          if (randomMoveMode && (agv.status === 'IDLE' || agv.status === 'COMPLETED') && agv.currentSpeed < 0.1) {
              if (Math.random() < 0.05) {
                  const reservedTargets = new Set(
                      prevAgvs
                        .filter(a => a.id !== agv.id && a.targetNode)
                        .map(a => a.targetNode)
                  );

                  const possibleTargets = mapData.nodes.filter(n => 
                      n.id !== agv.currentNode && !reservedTargets.has(n.id)
                  );

                  if (possibleTargets.length > 0) {
                      const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
                      const newPath = findPath(agv.currentNode, randomTarget.id, graph);
                      
                      return {
                          ...agv,
                          targetNode: randomTarget.id,
                          path: newPath,
                          status: 'PLANNING',
                          waitTimer: 0,
                          retryCount: 0,
                          pathRank: 0,
                          reservedNodes: newPath.slice(0, agv.hardBorrowLength) // Reservation uses AGV config
                      };
                  }
              }
          }

          // Movement Logic
          if (!agv.targetNode || agv.path.length === 0) {
              let newSpeed = Math.max(0, agv.currentSpeed - agv.deceleration);
              return { ...agv, status: 'IDLE', currentSpeed: newSpeed, waitTimer: 0, reservedNodes: [] };
          }

          const nextNodeId = agv.path[0];
          const currentNodeObj = mapData.nodes.find(n => n.id === agv.currentNode);
          const nextNodeObj = mapData.nodes.find(n => n.id === nextNodeId);

          if (!currentNodeObj || !nextNodeObj) return agv;

          const dx = nextNodeObj.x - currentNodeObj.x;
          const dy = nextNodeObj.y - currentNodeObj.y;
          const currentEdgeDistance = Math.sqrt(dx * dx + dy * dy);

          // Level 2 Planning: Update current reservation set before checking rules
          const currentAgvWithReservation = { ...agv, reservedNodes: agv.path.slice(0, agv.hardBorrowLength) };

          const { action, conflictReason, avoidData, blockerId } = checkTrafficRules(currentAgvWithReservation, prevAgvs, currentNodeObj, nextNodeObj);

          // REDIRECTION LOGIC 
          if (action === 'REPATH_HEAD_ON') {
               const allPaths = findAllPaths(agv.currentNode, agv.targetNode, graph, [], [avoidData]);
               
               const targetRank = agv.pathRank === 0 ? 1 : agv.pathRank;
               const detourPath = (allPaths.length > targetRank) ? allPaths[targetRank].path : (allPaths[0]?.path || []);

               if (detourPath.length > 0) {
                   const newReservedNodes = detourPath.slice(0, agv.hardBorrowLength); // Use AGV config
                   
                   if (agv.progress < 0.05) {
                       return { 
                           ...agv, 
                           path: detourPath, 
                           status: 'REPATHING', 
                           waitTimer: 0, 
                           pathRank: targetRank,
                           currentSpeed: 0,
                           reservedNodes: newReservedNodes
                       };
                   } else {
                       return {
                           ...agv,
                           currentNode: nextNodeId,
                           path: [agv.currentNode, ...detourPath],
                           progress: 1 - agv.progress,
                           progressDistance: currentEdgeDistance * (1 - agv.progress),
                           status: 'REPATHING',
                           waitTimer: 0,
                           currentSpeed: 0,
                           pathRank: targetRank,
                           reservedNodes: newReservedNodes
                       };
                   }
               }
               return { ...agv, status: 'BLOCKED', waitTimer: 0, currentSpeed: Math.max(0, agv.currentSpeed - agv.deceleration), reservedNodes: [] };
          }

          if (action === 'WAIT') {
              let newSpeed = Math.max(0, agv.currentSpeed - agv.deceleration);
              const newTimer = agv.waitTimer + 1;
              
              if (newTimer > RETRY_INTERVAL) {
                  const newRetryCount = agv.retryCount + 1;
                  
                  // --- STEP BACK LOGIC ---
                  const blocker = prevAgvs.find(a => a.id === blockerId);
                  const isBlockerWaiting = blocker && (blocker.status === 'WAITING' || blocker.status === 'BLOCKED');
                  
                  if (newRetryCount >= 3 && isBlockerWaiting) {
                       let stepBackNode = null;
                       let isReversingMidEdge = false;

                       if (agv.progress > 0.1) {
                            stepBackNode = agv.currentNode;
                            isReversingMidEdge = true;
                       } 
                       else if (agv.previousNode && graph[agv.currentNode].some(n => n.node === agv.previousNode)) {
                            stepBackNode = agv.previousNode;
                       }
                       else {
                            const neighbors = graph[agv.currentNode].map(n => n.node);
                            const validNeighbors = neighbors.filter(n => n !== nextNodeId);
                            if (validNeighbors.length > 0) {
                                stepBackNode = validNeighbors[0];
                            }
                       }

                       if (stepBackNode) {
                           const newPathToTarget = findPath(stepBackNode, agv.targetNode, graph);
                           const newReservedNodes = newPathToTarget.slice(0, agv.hardBorrowLength); // Use AGV config
                           
                           if (isReversingMidEdge) {
                               return {
                                   ...agv,
                                   currentNode: nextNodeId, 
                                   path: [agv.currentNode, ...newPathToTarget],
                                   progress: 1 - agv.progress,
                                   progressDistance: currentEdgeDistance * (1 - agv.progress),
                                   status: 'REPATHING', 
                                   waitTimer: 0,
                                   retryCount: 0,
                                   currentSpeed: 0,
                                   reservedNodes: newReservedNodes
                               };
                           } else {
                               return {
                                   ...agv,
                                   path: [stepBackNode, ...newPathToTarget],
                                   status: 'DETOUR',
                                   waitTimer: 0,
                                   retryCount: 0,
                                   currentSpeed: 0,
                                   reservedNodes: newReservedNodes
                               };
                           }
                       }
                  }

                  // --- STANDARD RANKED RETRY ---
                  let newPathRank = agv.pathRank;
                  if (newRetryCount >= MAX_RETRIES_PER_RANK) {
                      newPathRank = agv.pathRank + 1; 
                  }

                  const blockedNodeId = nextNodeId; 
                  const oldCurrentNodeId = agv.currentNode;
                  
                  const allPaths = findAllPaths(oldCurrentNodeId, agv.targetNode, graph, [blockedNodeId], []);
                  const detourPathObj = (allPaths.length > newPathRank) ? allPaths[newPathRank] : allPaths[allPaths.length - 1];
                  const detourPath = detourPathObj ? detourPathObj.path : [];

                  if (detourPath.length > 0) {
                      const newReservedNodes = detourPath.slice(0, agv.hardBorrowLength); // Use AGV config
                       if (agv.progress > 0) {
                          return {
                              ...agv,
                              currentNode: blockedNodeId,
                              path: [oldCurrentNodeId, ...detourPath],
                              progress: 1 - agv.progress,
                              progressDistance: currentEdgeDistance * (1 - agv.progress),
                              status: 'DETOUR',
                              waitTimer: 0,
                              currentSpeed: 0,
                              retryCount: newRetryCount >= MAX_RETRIES_PER_RANK ? 0 : newRetryCount,
                              pathRank: newPathRank,
                              reservedNodes: newReservedNodes
                          };
                      } else {
                          return {
                              ...agv,
                              path: detourPath,
                              status: 'DETOUR',
                              waitTimer: 0,
                              retryCount: newRetryCount >= MAX_RETRIES_PER_RANK ? 0 : newRetryCount,
                              pathRank: newPathRank,
                              currentSpeed: 0,
                              reservedNodes: newReservedNodes
                          };
                      }
                  } else {
                      return { ...agv, status: 'WAITING', waitReason: conflictReason, waitTimer: 0, currentSpeed: newSpeed, retryCount: newRetryCount, reservedNodes: [] };
                  }
              }
              return { ...agv, status: 'WAITING', waitReason: conflictReason, waitTimer: newTimer, currentSpeed: newSpeed };
          }

          // 4. PHYSICS ENGINE
          let targetSpeed = agv.maxSpeed;
          const distRemaining = currentEdgeDistance - agv.progressDistance;
          const isFinalEdge = agv.path.length === 1;
          
          if (isFinalEdge) {
              const brakingDist = (agv.currentSpeed * agv.currentSpeed) / (2 * agv.deceleration);
              if (distRemaining <= brakingDist + 5) {
                  targetSpeed = 0;
              }
          }

          let newSpeed = agv.currentSpeed;
          if (newSpeed < targetSpeed) {
              newSpeed = Math.min(newSpeed + agv.acceleration, targetSpeed);
          } else if (newSpeed > targetSpeed) {
              newSpeed = Math.max(newSpeed - agv.deceleration, targetSpeed);
          }
          
          let newProgressDistance = agv.progressDistance + newSpeed;
          let progress = newProgressDistance / currentEdgeDistance;

          // FIX: Snap to Arrival
          if (isFinalEdge && distRemaining < 10 && newSpeed < 0.5) {
              progress = 1;
              newProgressDistance = currentEdgeDistance;
          }
          
          if (progress > 1) progress = 1;

          const newX = currentNodeObj.x + (dx * progress);
          const newY = currentNodeObj.y + (dy * progress);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          if (progress >= 1) {
            // Arrived at node
            const remainingPath = agv.path.slice(1);
            const hasArrived = remainingPath.length === 0;
            const finalReservedNodes = hasArrived ? [] : remainingPath.slice(0, agv.hardBorrowLength); // Use AGV config
            
            return {
              ...agv,
              x: nextNodeObj.x,
              y: nextNodeObj.y,
              currentNode: nextNodeId,
              previousNode: agv.currentNode, // Track history for Step Back logic
              path: remainingPath,
              progressDistance: 0,
              progress: 0,
              orientation: angle,
              status: hasArrived ? 'COMPLETED' : 'MOVING',
              targetNode: hasArrived ? null : agv.targetNode,
              waitTimer: 0,
              waitReason: null,
              currentSpeed: hasArrived ? 0 : newSpeed,
              retryCount: 0,
              pathRank: 0,
              reservedNodes: finalReservedNodes // Release/Update Reservation
            };
          } else {
            // Moving
            return {
              ...agv,
              x: newX,
              y: newY,
              progressDistance: newProgressDistance,
              progress: progress,
              orientation: angle,
              status: 'MOVING',
              waitTimer: 0,
              waitReason: null,
              currentSpeed: newSpeed,
              reservedNodes: currentAgvWithReservation.reservedNodes // Keep reservation
            };
          }
        });
      });

      animationFrameId = requestAnimationFrame(updateSimulation);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateSimulation);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, mapData, graph, randomMoveMode]); 

  // --- Actions ---

  const spawnAgv = () => {
    const safeNodes = mapData.nodes.filter(node => {
        const isObstructed = agvs.some(agv => {
            const dist = Math.sqrt(Math.pow(agv.x - node.x, 2) + Math.pow(agv.y - node.y, 2));
            return dist < defaultFleetConfig.safetyDistance * 2;
        });
        return !isObstructed;
    });

    let startNode;
    if (safeNodes.length > 0) {
        startNode = safeNodes[Math.floor(Math.random() * safeNodes.length)];
    } else {
        startNode = mapData.nodes[Math.floor(Math.random() * mapData.nodes.length)];
    }

    const newAgv = {
      id: Date.now(),
      x: startNode.x,
      y: startNode.y,
      currentNode: startNode.id,
      previousNode: null, // History Init
      targetNode: null,
      path: [],
      progress: 0,
      progressDistance: 0,
      orientation: 0,
      status: 'IDLE',
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      waitTimer: 0,
      waitReason: null,
      // Inherit configurable parameters
      maxSpeed: defaultFleetConfig.maxSpeed,
      acceleration: defaultFleetConfig.acceleration,
      deceleration: defaultFleetConfig.deceleration,
      currentSpeed: 0,
      safetyDistance: defaultFleetConfig.safetyDistance,
      hardBorrowLength: defaultFleetConfig.hardBorrowLength, // Use default config
      // Logic State
      retryCount: 0,
      pathRank: 0,
      reservedNodes: [] 
    };
    setAgvs([...agvs, newAgv]);
    if (!selectedAgvId) setSelectedAgvId(newAgv.id);
  };

  const handleNodeClick = (nodeId) => {
    if (!selectedAgvId) return;

    setAgvs(prev => prev.map(agv => {
      if (agv.id !== selectedAgvId) return agv;

      let searchStartNode = agv.currentNode;
      let pathPrefix = [];

      if (agv.path.length > 0 && agv.progress > 0) {
        searchStartNode = agv.path[0];
        pathPrefix = [agv.path[0]];
      }

      const newRoute = findPath(searchStartNode, nodeId, graph);
      const fullPath = [...pathPrefix, ...newRoute];
      const newReservedNodes = fullPath.slice(0, agv.hardBorrowLength);
      
      return {
        ...agv,
        targetNode: nodeId,
        path: fullPath,
        status: 'PLANNING',
        waitTimer: 0,
        waitReason: null,
        retryCount: 0,
        pathRank: 0,
        reservedNodes: newReservedNodes
      };
    }));
    setIsPlaying(true);
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    setAgvs([]);
    setSelectedAgvId(null);
  };

  const calculateRemainingCost = (agv) => {
    if (!agv.path.length) return 0;
    let cost = 0;
    let current = agv.currentNode;
    
    if (agv.path.length > 0) {
        const next = agv.path[0];
        const edge = mapData.edges.find(e => (e.source === current && e.target === next) || (e.source === next && e.target === current));
        if (edge) {
            cost += edge.weight * (1 - agv.progress);
        }
    }
    for (let i = 0; i < agv.path.length - 1; i++) {
        const u = agv.path[i];
        const v = agv.path[i+1];
        const edge = mapData.edges.find(e => (e.source === u && e.target === v) || (e.source === v && e.target === u));
        if (edge) cost += edge.weight;
    }
    return Math.round(cost);
  };


  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden select-none">
      {/* Header */}
      <header className="h-16 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-800 shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Navigation className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AGV Traffic Control</h1>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider">V4.1 // CONFIGURABLE RESERVATION</div>
          </div>
        </div>
        
        {/* Map Control Bar - UPDATED LAYOUT */}
        <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 p-1.5 px-4 rounded-lg mx-4 shadow-sm">
            {/* Seed Section */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Seed:</span>
                <div className="relative group">
                    <input 
                        type="text" 
                        value={seed} 
                        onChange={(e) => setSeed(e.target.value)}
                        className="bg-slate-800 text-xs font-mono text-green-400 w-28 px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-green-500 border border-transparent"
                        placeholder="Seed..."
                    />
                    <button 
                        onClick={randomizeSeed}
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        title="Randomize"
                    >
                        <Dice5 size={12} />
                    </button>
                </div>
            </div>
            
            {/* Divider */}
            <div className="w-[1px] h-4 bg-slate-700"></div>

            {/* Nodes Section */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Nodes:</span>
                <input 
                    type="number" 
                    min="5" max="40"
                    value={nodeCount} 
                    onChange={(e) => setNodeCount(parseInt(e.target.value) || 14)}
                    className="bg-slate-800 text-xs font-mono text-blue-400 w-12 px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 border border-transparent"
                />
            </div>

            {/* Divider */}
            <div className="w-[1px] h-4 bg-slate-700"></div>

            {/* Render Button */}
            <button 
                onClick={regenerateMap} 
                className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-all active:scale-95" 
                title="Regenerate Map"
            >
                <RefreshCw size={14} />
            </button>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-700 p-1 rounded-lg">
                {/* Run / Pause */}
                <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${isPlaying ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {isPlaying ? <><Pause size={18}/> Pause</> : <><Play size={18}/> Run</>}
                </button>
                
                {/* Auto Pilot */}
                <button 
                    onClick={() => setRandomMoveMode(!randomMoveMode)} 
                    className={`p-2 rounded-md transition-colors flex items-center gap-2 ${randomMoveMode ? 'bg-purple-600 text-white shadow-inner shadow-purple-900' : 'hover:bg-slate-600 text-slate-300 hover:text-white'}`}
                    title="Auto-Pilot (Random Move)"
                >
                    <Shuffle size={18} />
                    {randomMoveMode && <span className="text-xs font-bold">AUTO</span>}
                </button>

                {/* Reset */}
                <button 
                    onClick={resetSimulation} 
                    className="p-2 hover:bg-slate-600 rounded-md text-slate-300 hover:text-white"
                    title="Reset Simulation"
                >
                    <RotateCcw size={18} />
                </button>
            </div>
            <button 
                onClick={spawnAgv}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors shadow-sm"
            >
                <Plus size={18} /> Spawn AGV
            </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Visualization Canvas */}
        <div 
            ref={svgContainerRef}
            className="flex-1 relative bg-slate-950 overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
            <div className="bg-black/50 backdrop-blur px-3 py-1 rounded text-xs text-slate-400 border border-white/10 flex items-center gap-2">
                <MapPin size={12} className="text-green-500"/>
                Scroll to Zoom • Drag to Pan
            </div>
            <div className="bg-black/50 backdrop-blur px-3 py-1 rounded text-xs text-slate-400 border border-white/10 flex items-center gap-2">
                 <Move size={12} className="text-blue-400"/>
                 Zoom: {viewTransform.k.toFixed(2)}x
            </div>
            {randomMoveMode && (
                <div className="bg-purple-900/80 backdrop-blur px-3 py-1 rounded text-xs text-purple-100 border border-purple-500/50 flex items-center gap-2 animate-pulse">
                    <Shuffle size={12} />
                    Auto-Pilot Active
                </div>
            )}
          </div>

          <svg className="w-full h-full">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1"/>
              </pattern>
            </defs>
            
            {/* Map Group with Transform */}
            <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
                
                {/* Background Grid - Scaled to cover infinite area visually if needed, but here simple rect */}
                <rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid)" />

                {/* Edges */}
                {mapData.edges.map((edge, idx) => {
                  const start = mapData.nodes.find(n => n.id === edge.source);
                  const end = mapData.nodes.find(n => n.id === edge.target);
                  if (!start || !end) return null;

                  const isActivePath = selectedAgvData && (
                    (selectedAgvData.currentNode === edge.source && selectedAgvData.path[0] === edge.target) ||
                    (selectedAgvData.currentNode === edge.target && selectedAgvData.path[0] === edge.source) ||
                    selectedAgvData.path.some((nodeId, i) => {
                        if (i === selectedAgvData.path.length - 1) return false;
                        const nextNodeId = selectedAgvData.path[i+1];
                        return (nodeId === edge.source && nextNodeId === edge.target) || (nodeId === edge.target && nextNodeId === edge.source);
                    })
                  );

                  return (
                    <g key={`edge-${idx}`}>
                        {isActivePath && (
                            <line 
                                x1={start.x} y1={start.y} 
                                x2={end.x} y2={end.y} 
                                stroke={selectedAgvData.status === 'WAITING' ? "#fbbf24" : selectedAgvData.status === 'REPATHING' ? "#a855f7" : "#22c55e"} 
                                strokeWidth="12" 
                                strokeLinecap="round"
                                opacity="0.2"
                            />
                        )}
                        <line 
                            x1={start.x} y1={start.y} 
                            x2={end.x} y2={end.y} 
                            stroke={isActivePath ? (selectedAgvData.status === 'WAITING' ? "#fbbf24" : "#22c55e") : "#334155"} 
                            strokeWidth="8" 
                            strokeLinecap="round"
                        />
                        <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 10} fill="#64748b" fontSize="10" textAnchor="middle">{edge.weight}</text>
                    </g>
                  );
                })}

                {/* Nodes */}
                {mapData.nodes.map((node) => {
                    const isTarget = selectedAgvData?.targetNode === node.id;
                    const isCurrent = selectedAgvData?.currentNode === node.id;
                    const isPath = selectedAgvData?.path.includes(node.id);
                    // Check if reserved by any other AGV
                    const isReserved = agvs.some(agv => agv.reservedNodes && agv.reservedNodes.includes(node.id) && agv.id !== selectedAgvId);

                    return (
                        <g 
                            key={node.id} 
                            onClick={(e) => { e.stopPropagation(); handleNodeClick(node.id); }}
                            className="cursor-pointer transition-all duration-300 hover:opacity-80"
                        >
                            {/* Reserved Indicator */}
                            {isReserved && !isTarget && !isCurrent && (
                                <circle cx={node.x} cy={node.y} r={NODE_RADIUS + 4} fill="#8b5cf6" opacity="0.3" />
                            )}
                            
                            {isTarget && (
                                 <circle cx={node.x} cy={node.y} r={NODE_RADIUS + 8} fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="4,2">
                                    <animate attributeName="stroke-dashoffset" from="0" to="12" dur="1s" repeatCount="indefinite" />
                                 </circle>
                            )}
                            <circle 
                                cx={node.x} cy={node.y} r={NODE_RADIUS} 
                                fill={isTarget ? '#22c55e' : isCurrent ? '#3b82f6' : '#1e293b'}
                                stroke={isPath ? '#4ade80' : '#475569'}
                                strokeWidth={isPath ? 3 : 2}
                            />
                            <text x={node.x} y={node.y} dy=".3em" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" pointerEvents="none">{node.id}</text>
                            <text x={node.x} y={node.y + 28} textAnchor="middle" fill="#94a3b8" fontSize="10" pointerEvents="none">{node.label}</text>
                        </g>
                    );
                })}

                {/* AGVs */}
                {agvs.map(agv => {
                    const isSelected = selectedAgvId === agv.id;
                    const isWarning = agv.status === 'WAITING' || agv.status === 'BLOCKED';

                    return (
                        <g 
                            key={agv.id} 
                            transform={`translate(${agv.x}, ${agv.y}) rotate(${agv.orientation})`}
                            onClick={(e) => { e.stopPropagation(); setSelectedAgvId(agv.id); }}
                            className="cursor-pointer"
                        >
                            {isSelected && <circle cx={0} cy={0} r={28} fill="white" opacity="0.1" />}
                            {isWarning && (
                                <circle cx={0} cy={0} r={22} fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.8">
                                    <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1s" repeatCount="indefinite" />
                                </circle>
                            )}
                            <rect x="-12" y="-12" width="24" height="24" rx="4" fill={agv.color} stroke="white" strokeWidth="2" />
                            <path d="M 0 -8 L 8 0 L 0 8" fill="none" stroke="white" strokeWidth="2" />
                        </g>
                    )
                })}
            </g>
          </svg>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col z-20 shadow-xl">
            
            {/* Fleet Configuration Panel Header */}
            <div className="p-3 border-b border-slate-700 bg-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-colors"
                onClick={() => setShowConfig(!showConfig)}
            >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <Settings size={14} /> 
                    {selectedAgvId ? `Editing AGV-${selectedAgvId.toString().slice(-4)}` : 'Spawn Defaults'}
                </div>
                {showConfig ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </div>

            {/* Collapsible Config Body */}
            {showConfig && (
                <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-300">
                                <span>Max Speed</span>
                                <span className="font-mono text-blue-400">{activeConfig.maxSpeed} px/t</span>
                            </div>
                            <input 
                                type="range" min="0" max="10" step="0.01" 
                                value={activeConfig.maxSpeed}
                                onChange={(e) => handleConfigChange('maxSpeed', e.target.value)}
                                className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-300">
                                    <span>Accel</span>
                                    <span className="font-mono text-green-400">{activeConfig.acceleration}</span>
                                </div>
                                <input 
                                    type="range" min="0.01" max="0.5" step="0.01" 
                                    value={activeConfig.acceleration}
                                    onChange={(e) => handleConfigChange('acceleration', e.target.value)}
                                    className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-300">
                                    <span>Decel</span>
                                    <span className="font-mono text-red-400">{activeConfig.deceleration}</span>
                                </div>
                                <input 
                                    type="range" min="0.01" max="0.5" step="0.01" 
                                    value={activeConfig.deceleration}
                                    onChange={(e) => handleConfigChange('deceleration', e.target.value)}
                                    className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-red-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-300">
                                <span>Safe Dist</span>
                                <span className="font-mono text-amber-400">{activeConfig.safetyDistance} px</span>
                            </div>
                            <input 
                                type="range" min="20" max="80" step="5" 
                                value={activeConfig.safetyDistance}
                                onChange={(e) => handleConfigChange('safetyDistance', e.target.value)}
                                className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>
                        
                        {/* NEW CONFIG: Hard Borrow Length */}
                        <div className="space-y-1 pt-4 border-t border-slate-700/50">
                            <div className="flex justify-between text-xs text-slate-300">
                                <span>Reserved Nodes (Hard Borrow)</span>
                                <span className="font-mono text-purple-400">{activeConfig.hardBorrowLength} nodes</span>
                            </div>
                            <input 
                                type="range" min="0" max="5" step="1" 
                                value={activeConfig.hardBorrowLength}
                                onChange={(e) => handleConfigChange('hardBorrowLength', e.target.value)}
                                className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                            <p className="text-[10px] text-slate-500">
                                AGV reserves this many nodes ahead to block conflicting path planning.
                            </p>
                        </div>
                        {/* END NEW CONFIG */}

                    </div>
                </div>
            )}

            <div className="p-4 border-b border-slate-700">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Active Fleet</h2>
                {agvs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 border border-dashed border-slate-700 rounded-lg">
                        <p className="mb-2">No AGVs Active</p>
                        <button onClick={spawnAgv} className="text-blue-400 hover:text-blue-300 text-sm">Spawn One</button>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {agvs.map(agv => {
                            let statusColor = 'bg-slate-700 text-slate-300';
                            if (agv.status === 'WAITING') statusColor = 'bg-amber-900/50 text-amber-200 border border-amber-800';
                            else if (agv.status === 'REPATHING' || agv.status === 'DETOUR') statusColor = 'bg-purple-900/50 text-purple-200 border border-purple-800';
                            else if (agv.status === 'MOVING') statusColor = 'bg-blue-900/50 text-blue-300';
                            else if (agv.status === 'COMPLETED') statusColor = 'bg-green-900/50 text-green-300';

                            return (
                                <div 
                                    key={agv.id}
                                    onClick={() => setSelectedAgvId(agv.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedAgvId === agv.id ? 'bg-slate-800 border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ background: agv.color }}></div>
                                            <span className="font-mono text-sm">AGV-{agv.id.toString().slice(-4)}</span>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${statusColor}`}>
                                            {agv.status}
                                            {agv.pathRank > 0 && <span className="ml-1 opacity-70">R{agv.pathRank}</span>}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400 items-center">
                                        <span>Current: <strong>{agv.currentNode}</strong></span>
                                        <span className="font-mono text-[10px] text-slate-500">v={agv.currentSpeed.toFixed(1)}</span>
                                    </div>
                                    {agv.pathRank > 0 && (
                                        <div className="mt-1 text-[9px] text-purple-400 flex items-center gap-1">
                                            <ArrowRightLeft size={8} /> Attempting Alt Path {agv.pathRank}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedAgvData && (
                <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Unit Telemetry</h2>
                    <div className="bg-slate-800 rounded-xl p-4 space-y-4 shadow-inner">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Current Node</label>
                                <div className="text-xl font-mono">{selectedAgvData.currentNode}</div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Target</label>
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className={selectedAgvData.targetNode ? "text-green-500" : "text-slate-600"} />
                                    <span className="text-xl font-mono">{selectedAgvData.targetNode || "N/A"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Speedometer Visual */}
                        <div className="relative pt-2">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Speed</span>
                                <span>{selectedAgvData.currentSpeed.toFixed(1)} / {selectedAgvData.maxSpeed}</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-cyan-400 transition-all duration-75"
                                    style={{ width: `${(selectedAgvData.currentSpeed / selectedAgvData.maxSpeed) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Cost</label>
                                <div className="text-lg font-mono text-amber-500">
                                    {calculateRemainingCost(selectedAgvData)}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Steps</label>
                                <div className="text-lg font-mono text-slate-300">
                                    {selectedAgvData.path.length}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-1 text-center text-[10px] text-slate-500 font-mono">
        Author: Kittawat Thongpud
      </footer>
    </div>
  );
}