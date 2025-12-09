import React, { useRef } from 'react';
import { MapData, AGV, ViewTransform } from '../types';
import { MapPin, Navigation, Truck } from 'lucide-react';

interface MapCanvasProps {
    mapData: MapData;
    agvs: AGV[];
    viewTransform: ViewTransform;
    onWheel: (e: React.WheelEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    selectedAgvId: number | null;
    onSelectAgv: (id: number) => void;
    showAllPaths: boolean;
    onNodeClick?: (nodeId: string) => void;
}

const NODE_RADIUS = 15;

const MapCanvas: React.FC<MapCanvasProps> = ({
    mapData,
    agvs,
    viewTransform,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    selectedAgvId,
    onSelectAgv,
    showAllPaths,
    onNodeClick
}) => {
    const svgContainerRef = useRef<HTMLDivElement>(null);

    return (
        <div 
            ref={svgContainerRef}
            className="flex-1 bg-gray-900 relative overflow-hidden cursor-move"
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
        >
            <svg width="100%" height="100%">
                <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
                    {/* Edges */}
                    {mapData.edges.map((edge, i) => {
                        const start = mapData.nodes.find(n => n.id === edge.source);
                        const end = mapData.nodes.find(n => n.id === edge.target);
                        if (!start || !end) return null;
                        return (
                            <g key={i}>
                                <line 
                                    x1={start.x} y1={start.y} 
                                    x2={end.x} y2={end.y} 
                                    stroke="#374151" 
                                    strokeWidth="4" 
                                />
                                <text 
                                    x={(start.x + end.x) / 2} 
                                    y={(start.y + end.y) / 2} 
                                    fill="#6B7280" 
                                    fontSize="10"
                                    textAnchor="middle"
                                >
                                    {edge.weight}
                                </text>
                            </g>
                        );
                    })}

                    {/* Paths and Reservations */}
                    {agvs.map(agv => {
                        const isSelected = selectedAgvId === agv.id;
                        if (!showAllPaths && !isSelected) return null;

                        // Soft Path (Dashed)
                        const pathElements = [];
                        if (agv.path && agv.path.length > 0) {
                            const pathNodes = [agv.currentNode, ...agv.path];
                            pathElements.push(
                                <g key={`path-${agv.id}`}>
                                    {pathNodes.map((nodeId, i) => {
                                        if (i === pathNodes.length - 1) return null;
                                        const startNode = mapData.nodes.find(n => n.id === nodeId);
                                        const endNode = mapData.nodes.find(n => n.id === pathNodes[i+1]);
                                        if (!startNode || !endNode) return null;
                                        
                                        const x1 = (i === 0) ? agv.x : startNode.x;
                                        const y1 = (i === 0) ? agv.y : startNode.y;

                                        return (
                                            <line 
                                                key={`line-${i}`}
                                                x1={x1} y1={y1} 
                                                x2={endNode.x} y2={endNode.y} 
                                                stroke={agv.color} 
                                                strokeWidth={isSelected ? "3" : "1.5"} 
                                                strokeDasharray="5 5"
                                                opacity={isSelected ? "0.4" : "0.2"}
                                            />
                                        );
                                    })}
                                </g>
                            );
                        }

                        // Hard Borrow / Reservation (Solid Overlay)
                        const reservationElements = [];
                        if (agv.reservedNodes && agv.reservedNodes.length > 0) {
                             // We need to connect reserved nodes with lines
                             // Assuming reservedNodes are in order of path
                             // We can try to map them to edges or just draw lines between them
                             
                             // Filter reserved nodes that are in the path (to know order) or just use the list if it's ordered
                             // The trafficManager adds them in order.
                             
                             const reservedNodesList = [agv.currentNode, ...agv.reservedNodes];
                             
                             reservationElements.push(
                                <g key={`res-${agv.id}`}>
                                    {reservedNodesList.map((nodeId, i) => {
                                        if (i === reservedNodesList.length - 1) return null;
                                        const startNode = mapData.nodes.find(n => n.id === nodeId);
                                        const endNode = mapData.nodes.find(n => n.id === reservedNodesList[i+1]);
                                        
                                        // Only draw if both exist (sanity check)
                                        if (!startNode || !endNode) return null;

                                        // Check if this segment is actually part of the graph (edge exists)
                                        // Visual improvement: Draw a thick semi-transparent line
                                        
                                        const x1 = (i === 0) ? agv.x : startNode.x;
                                        const y1 = (i === 0) ? agv.y : startNode.y;

                                        return (
                                            <line 
                                                key={`res-line-${i}`}
                                                x1={x1} y1={y1} 
                                                x2={endNode.x} y2={endNode.y} 
                                                stroke={agv.color} 
                                                strokeWidth={isSelected ? "6" : "4"} 
                                                opacity={isSelected ? "0.8" : "0.5"}
                                                strokeLinecap="round"
                                            />
                                        );
                                    })}
                                </g>
                             );
                        }

                        return (
                            <g key={`vis-${agv.id}`}>
                                {pathElements}
                                {reservationElements}
                            </g>
                        );
                    })}

                    {/* Goal Node Highlights */}
                    {agvs.map(agv => {
                        if (!agv.targetNode) return null;
                        const targetNode = mapData.nodes.find(n => n.id === agv.targetNode);
                        if (!targetNode) return null;
                        
                        const isSelected = selectedAgvId === agv.id;
                        if (!showAllPaths && !isSelected) return null;

                        return (
                            <g key={`goal-${agv.id}`} transform={`translate(${targetNode.x}, ${targetNode.y})`}>
                                {/* Pulse Effect for Goal */}
                                <circle r={NODE_RADIUS + 8} fill="none" stroke={agv.color} strokeWidth="2" opacity="0.5" className="animate-pulse" />
                                <circle r={NODE_RADIUS + 4} fill="none" stroke={agv.color} strokeWidth="2" opacity="0.8" />
                                {/* Flag Icon or similar */}
                                <g transform="translate(-8, -25)">
                                   <path d="M 4 0 L 4 16 M 4 0 L 14 5 L 4 10" stroke={agv.color} strokeWidth="2" fill={agv.color} fillOpacity="0.5" />
                                </g>
                            </g>
                        );
                    })}

                    {/* Nodes */}
                    {mapData.nodes.map(node => (
                        <g 
                            key={node.id} 
                            transform={`translate(${node.x}, ${node.y})`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onNodeClick) onNodeClick(node.id);
                            }}
                            className={onNodeClick ? "cursor-pointer hover:opacity-80" : ""}
                        >
                            <circle r={NODE_RADIUS} fill="#1F2937" stroke="#4B5563" strokeWidth="2" />
                            <text y="4" textAnchor="middle" fill="#9CA3AF" fontSize="10" fontWeight="bold">
                                {node.id}
                            </text>
                        </g>
                    ))}

                    {/* AGVs */}
                    {agvs.map(agv => (
                        <g 
                            key={agv.id} 
                            transform={`translate(${agv.x}, ${agv.y})`}
                            onClick={(e) => { e.stopPropagation(); onSelectAgv(agv.id); }}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                        >
                            {/* Selection Ring */}
                            {selectedAgvId === agv.id && (
                                <circle r="22" fill="none" stroke="white" strokeWidth="2" strokeDasharray="4 2" className="animate-spin-slow" />
                            )}

                            {/* AGV Body */}
                            <circle r="14" fill={agv.color} stroke="white" strokeWidth="2" />
                            
                            {/* Direction Indicator */}
                            <g transform={`rotate(${agv.orientation + 90})`}>
                                <path d="M 0,-8 L 6,4 L 0,2 L -6,4 Z" fill="white" />
                            </g>

                            {/* Status Icons */}
                            {agv.status === 'WAITING' && (
                                <g transform="translate(10, -10)">
                                    <circle r="8" fill="#EF4444" />
                                    <text x="0" y="3" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">!</text>
                                </g>
                            )}
                            {agv.status === 'REPATHING' && (
                                <g transform="translate(10, -10)">
                                    <circle r="8" fill="#F59E0B" />
                                    <text x="0" y="3" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">R</text>
                                </g>
                            )}
                            
                            {/* Label */}
                            <text y="24" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" className="pointer-events-none">
                                AGV-{agv.id.toString().slice(-4)}
                            </text>
                        </g>
                    ))}
                </g>
            </svg>

            {/* Overlay Info */}
            <div className="absolute top-4 left-4 bg-gray-800/80 p-2 rounded text-xs text-gray-300 pointer-events-none">
                <div className="flex items-center gap-2">
                    <MapPin size={14} /> Nodes: {mapData.nodes.length}
                </div>
                <div className="flex items-center gap-2">
                    <Navigation size={14} /> Edges: {mapData.edges.length}
                </div>
                <div className="flex items-center gap-2">
                    <Truck size={14} /> AGVs: {agvs.length}
                </div>
            </div>
        </div>
    );
};

export default MapCanvas;
