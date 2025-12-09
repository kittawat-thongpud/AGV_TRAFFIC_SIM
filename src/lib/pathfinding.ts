import { Graph, Node, Edge } from '../types';

export const buildGraph = (nodes: Node[], edges: Edge[]): Graph => {
  const graph: Graph = {};
  nodes.forEach(node => graph[node.id] = []);
  edges.forEach(edge => {
    graph[edge.source].push({ node: edge.target, weight: edge.weight });
    graph[edge.target].push({ node: edge.source, weight: edge.weight });
  });
  return graph;
};

export const findPath = (startNodeId: string, targetNodeId: string, graph: Graph, avoidNodes: string[] = [], avoidEdges: { u: string, v: string }[] = []): string[] => {
  const distances: { [key: string]: number } = {};
  const previous: { [key: string]: string | null } = {};
  const queue: string[] = [];

  for (const node in graph) {
    distances[node] = Infinity;
    previous[node] = null;
    queue.push(node);
  }
  distances[startNodeId] = 0;

  while (queue.length > 0) {
    queue.sort((a, b) => distances[a] - distances[b]);
    const u = queue.shift();

    if (!u) break;
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

  const path: string[] = [];
  let u: string | null = targetNodeId;
  if (previous[u] !== null || u === startNodeId) {
    while (u !== null) {
      path.unshift(u);
      u = previous[u];
    }
  }
  
  return path.length > 0 ? path.slice(1) : []; 
};

// Find K-Shortest simple paths (Ranked)
export const findAllPaths = (startNodeId: string, targetNodeId: string, graph: Graph, avoidNodes: string[] = [], avoidEdges: { u: string, v: string }[] = [], limit: number = 10): { path: string[], cost: number }[] => {
    let results: { path: string[], cost: number }[] = [];
    
    // DFS approach to find simple paths
    const dfs = (current: string, path: string[], cost: number) => {
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
