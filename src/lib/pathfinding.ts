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


