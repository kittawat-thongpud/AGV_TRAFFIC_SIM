export interface Node {
    id: string;
    x: number;
    y: number;
    label: string;
}

export interface Edge {
    source: string;
    target: string;
    weight: number;
}

export interface MapData {
    nodes: Node[];
    edges: Edge[];
}

export interface GraphNode {
    node: string;
    weight: number;
}

export interface Graph {
    [key: string]: GraphNode[];
}

export type AGVStatus = 'IDLE' | 'MOVING' | 'WAITING' | 'PLANNING' | 'COMPLETED' | 'REPATHING' | 'BLOCKED' | 'DETOUR';

export interface AGV {
    id: number;
    x: number;
    y: number;
    currentNode: string;
    previousNode: string | null;
    targetNode: string | null;
    path: string[];
    progress: number;
    progressDistance: number;
    orientation: number;
    status: AGVStatus;
    color: string;
    waitTimer: number;
    waitReason: string | null;
    
    // Configurable parameters
    maxSpeed: number;
    acceleration: number;
    deceleration: number;
    safetyDistance: number;
    hardBorrowLength: number;
    
    // State
    currentSpeed: number;
    retryCount: number;
    pathRank: number;
    reservedNodes: string[];
}

export interface FleetConfig {
    maxSpeed: number;
    acceleration: number;
    deceleration: number;
    safetyDistance: number;
    hardBorrowLength: number;
}

export interface ViewTransform {
    x: number;
    y: number;
    k: number;
}
