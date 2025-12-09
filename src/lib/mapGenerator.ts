import { MapData, Node, Edge } from '../types';

// --- Random Number Generator (Seeded) ---
const mulberry32 = (a: number) => {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const stringToSeed = (str: string): number => {
    let hash = 0, i, chr;
    if (str.length === 0) return hash;
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; 
    }
    return Math.abs(hash);
};

export const generateMapData = (seedStr: string, numNodes: number = 14): MapData => {
    const seed = stringToSeed(seedStr);
    const random = mulberry32(seed);
    
    // Dynamic dimensions based on node count to ensure they fit with collision spacing
    // Base area 800x600. Min distance 80px.
    // Area per node circle ~ (80)^2 = 6400.
    // With packing factor 2.5:
    const minDistance = 80;
    const densityFactor = 2.5;
    const requiredArea = Math.max(800 * 600, numNodes * (minDistance * minDistance) * densityFactor);
    const aspectRatio = 800 / 600;
    
    const height = Math.sqrt(requiredArea / aspectRatio);
    const width = height * aspectRatio;

    const padding = 50;
    
    const nodes: Node[] = [];
    const edges: Edge[] = [];
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
    const processedPairs = new Set<string>();
    
    nodes.forEach((nodeA, i) => {
        const distances = nodes
            .map((nodeB, j) => {
                if (i === j) return null;
                const dist = Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2));
                return { node: nodeB, dist, id: nodeB.id };
            })
            .filter((item): item is { node: Node, dist: number, id: string } => item !== null)
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
