import { useState, useEffect, useMemo, useRef } from 'react';
import { AGV, MapData, FleetConfig } from '../types';
import { buildGraph, findPath } from '../lib/pathfinding';
import { checkTrafficRules } from '../lib/trafficManager';

const RETRY_INTERVAL = 60;


export const useSimulation = (mapData: MapData, initialFleetConfig: FleetConfig) => {
    const [agvs, setAgvs] = useState<AGV[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [randomMoveMode, setRandomMoveMode] = useState(false);
    const [selectedAgvId, setSelectedAgvId] = useState<number | null>(null);
    const [fleetConfig, setFleetConfig] = useState<FleetConfig>(initialFleetConfig);

    const graph = useMemo(() => buildGraph(mapData.nodes, mapData.edges), [mapData]);
    const animationFrameId = useRef<number | undefined>(undefined);

    const spawnAgv = () => {
        const safeNodes = mapData.nodes.filter(node => {
            const isObstructed = agvs.some(agv => {
                const dist = Math.sqrt(Math.pow(agv.x - node.x, 2) + Math.pow(agv.y - node.y, 2));
                return dist < fleetConfig.safetyDistance * 2;
            });
            return !isObstructed;
        });

        let startNode;
        if (safeNodes.length > 0) {
            startNode = safeNodes[Math.floor(Math.random() * safeNodes.length)];
        } else {
            startNode = mapData.nodes[Math.floor(Math.random() * mapData.nodes.length)];
        }

        const newAgv: AGV = {
            id: Date.now(),
            x: startNode.x,
            y: startNode.y,
            currentNode: startNode.id,
            previousNode: null,
            targetNode: null,
            path: [],
            progress: 0,
            progressDistance: 0,
            orientation: 0,
            status: 'IDLE',
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            waitTimer: 0,
            waitReason: null,
            maxSpeed: fleetConfig.maxSpeed,
            acceleration: fleetConfig.acceleration,
            deceleration: fleetConfig.deceleration,
            safetyDistance: fleetConfig.safetyDistance,
            hardBorrowLength: fleetConfig.hardBorrowLength,
            currentSpeed: 0,
            retryCount: 0,
            pathRank: 0,
            reservedNodes: [],
            pathPlanningTime: Date.now()
        };

        setAgvs(prev => [...prev, newAgv]);
    };

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
                                reservedNodes: newPath.slice(0, agv.hardBorrowLength),
                                pathPlanningTime: Date.now()
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

                const currentAgvWithReservation = { ...agv, reservedNodes: agv.path.slice(0, agv.hardBorrowLength) };
                const { action, conflictReason, avoidData, blockerId } = checkTrafficRules(currentAgvWithReservation, prevAgvs, currentNodeObj, nextNodeObj);

                // REDIRECTION LOGIC 
                if (action === 'REPATH_HEAD_ON') {
                    // Optimized: Use findPath with constraints instead of findAllPaths
                    // Avoid the specific edge that caused the head-on conflict
                    const avoidEdges = avoidData ? [avoidData] : [];
                    const detourPath = findPath(agv.currentNode, agv.targetNode!, graph, [], avoidEdges);
                    
                    if (detourPath.length > 0) {
                        const newReservedNodes = detourPath.slice(0, agv.hardBorrowLength);
                        
                        if (agv.progress < 0.05) {
                            return { 
                                ...agv, 
                                path: detourPath, 
                                status: 'REPATHING', 
                                waitTimer: 0, 
                                pathRank: 0, // Reset rank as we found a specific detour
                                currentSpeed: 0,
                                reservedNodes: newReservedNodes,
                                pathPlanningTime: Date.now()
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
                                pathRank: 0,
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
                                const newPathToTarget = findPath(stepBackNode, agv.targetNode!, graph);
                                const newReservedNodes = newPathToTarget.slice(0, agv.hardBorrowLength);
                                
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
                        // Optimized: Instead of K-Shortest Paths, just try to avoid the blocked node.
                        // If we already tried avoiding it and failed, maybe we are stuck.
                        
                        const blockedNodeId = nextNodeId; 
                        const oldCurrentNodeId = agv.currentNode;
                        
                        // Try to find a path avoiding the node that is blocking us
                        const detourPath = findPath(oldCurrentNodeId, agv.targetNode!, graph, [blockedNodeId], []);

                        if (detourPath.length > 0) {
                            const newReservedNodes = detourPath.slice(0, agv.hardBorrowLength);
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
                                    retryCount: 0,
                                    pathRank: 0,
                                    reservedNodes: newReservedNodes
                                };
                            } else {
                                return {
                                    ...agv,
                                    path: detourPath,
                                    status: 'DETOUR',
                                    waitTimer: 0,
                                    retryCount: 0,
                                    pathRank: 0,
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
                    const finalReservedNodes = hasArrived ? [] : remainingPath.slice(0, agv.hardBorrowLength);
                    
                    return {
                        ...agv,
                        x: nextNodeObj.x,
                        y: nextNodeObj.y,
                        currentNode: nextNodeId,
                        previousNode: agv.currentNode,
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
                        reservedNodes: finalReservedNodes
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
                        reservedNodes: currentAgvWithReservation.reservedNodes
                    };
                }
            });
        });

        animationFrameId.current = requestAnimationFrame(updateSimulation);
    };

    useEffect(() => {
        if (isPlaying) {
            animationFrameId.current = requestAnimationFrame(updateSimulation);
        }
        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, [isPlaying, mapData, graph, randomMoveMode]);

    return {
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
        spawnAgv
    };
};
