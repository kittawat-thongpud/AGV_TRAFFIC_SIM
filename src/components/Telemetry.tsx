import React from 'react';
import { AGV } from '../types';
import { Gauge, Navigation, MapPin, Clock, AlertTriangle } from 'lucide-react';

interface TelemetryProps {
    agv: AGV | null;
}

const Telemetry: React.FC<TelemetryProps> = ({ agv }) => {
    if (!agv) {
        return (
            <div className="w-full bg-gray-800/90 backdrop-blur border border-gray-700 rounded-xl p-4 shadow-xl">
                <p className="text-gray-500 text-center italic">Select an AGV to view telemetry</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-gray-800/90 backdrop-blur border border-gray-700 rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: agv.color }} />
                    <h3 className="font-bold text-white">AGV-{agv.id.toString().slice(-4)}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                    agv.status === 'MOVING' ? 'bg-green-900 text-green-400' :
                    agv.status === 'WAITING' ? 'bg-red-900 text-red-400' :
                    agv.status === 'REPATHING' ? 'bg-yellow-900 text-yellow-400' :
                    'bg-gray-700 text-gray-400'
                }`}>
                    {agv.status}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Gauge size={12} /> Speed
                    </div>
                    <div className="text-xl font-mono text-white">
                        {agv.currentSpeed.toFixed(2)}
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock size={12} /> Wait Timer
                    </div>
                    <div className={`text-xl font-mono ${agv.waitTimer > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                        {agv.waitTimer}
                    </div>
                </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-700">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-1.5"><MapPin size={12}/> Current</span>
                    <span className="font-mono text-white">{agv.currentNode}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-1.5"><Navigation size={12}/> Target</span>
                    <span className="font-mono text-white">{agv.targetNode || '--'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Path Length</span>
                    <span className="font-mono text-white">{agv.path.length} nodes</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Reservations</span>
                    <span className="font-mono text-white">{agv.reservedNodes.length}</span>
                </div>
            </div>

            {agv.waitReason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded p-2 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-300 leading-tight">{agv.waitReason}</p>
                </div>
            )}
        </div>
    );
};

export default Telemetry;
