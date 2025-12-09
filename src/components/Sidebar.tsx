import React from 'react';
import { Settings, Sliders, Truck, AlertTriangle, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { FleetConfig, AGV } from '../types';

interface SidebarProps {
    config: FleetConfig;
    onConfigChange: (key: keyof FleetConfig, value: number) => void;
    selectedAgvId: number | null;

    agvs: AGV[];
    onSelectAgv: (id: number) => void;
    showAllPaths: boolean;
    onToggleShowAllPaths: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    config, 
    onConfigChange, 
    selectedAgvId,

    agvs,
    onSelectAgv,
    showAllPaths,
    onToggleShowAllPaths
}) => {
    return (
        <div className="w-full h-full bg-transparent p-4 flex flex-col gap-6 overflow-y-auto">
            <div className="flex items-center gap-2 text-xl font-bold text-white border-b border-gray-700 pb-4">
                <Settings className="text-blue-400" />
                <h2>Configuration</h2>
            </div>



            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-700 pb-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Fleet Settings</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={showAllPaths}
                            onChange={onToggleShowAllPaths}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/50"
                        />
                        <span className="text-xs text-gray-300">Show All Paths</span>
                    </label>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>Target:</span>
                    <span className={`px-2 py-1 rounded ${selectedAgvId ? 'bg-blue-900 text-blue-200' : 'bg-gray-700 text-gray-300'}`}>
                        {selectedAgvId ? `AGV-${selectedAgvId.toString().slice(-4)}` : 'Global Fleet'}
                    </span>
                </div>

                {/* Max Speed */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                            <Truck size={14} /> Max Speed
                        </div>
                        <span>{config.maxSpeed.toFixed(1)}</span>
                    </div>
                    <input 
                        type="range" min="1" max="10" step="0.1"
                        value={config.maxSpeed}
                        onChange={(e) => onConfigChange('maxSpeed', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Acceleration */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                            <ArrowRightLeft size={14} /> Acceleration
                        </div>
                        <span>{config.acceleration.toFixed(2)}</span>
                    </div>
                    <input 
                        type="range" min="0.01" max="0.5" step="0.01"
                        value={config.acceleration}
                        onChange={(e) => onConfigChange('acceleration', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                </div>

                {/* Deceleration */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={14} /> Deceleration
                        </div>
                        <span>{config.deceleration.toFixed(2)}</span>
                    </div>
                    <input 
                        type="range" min="0.01" max="0.5" step="0.01"
                        value={config.deceleration}
                        onChange={(e) => onConfigChange('deceleration', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                </div>

                {/* Safety Distance */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                            <ShieldAlert size={14} /> Safety Dist
                        </div>
                        <span>{config.safetyDistance}px</span>
                    </div>
                    <input 
                        type="range" min="20" max="100" step="5"
                        value={config.safetyDistance}
                        onChange={(e) => onConfigChange('safetyDistance', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                    />
                </div>

                {/* Hard Borrow Length */}
                <div className="space-y-2 pt-4 border-t border-gray-700">
                    <div className="flex justify-between text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                            <Sliders size={14} /> Reservation Lookahead
                        </div>
                        <span>{config.hardBorrowLength} nodes</span>
                    </div>
                    <input 
                        type="range" min="0" max="5" step="1"
                        value={config.hardBorrowLength}
                        onChange={(e) => onConfigChange('hardBorrowLength', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Number of nodes ahead to reserve (Hard Borrow). Higher values prevent deadlocks but reduce throughput.
                    </p>
                </div>
                </div>


            {/* AGV List */}
            <div className="space-y-4 pt-4 border-t border-gray-700">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Active AGVs ({agvs.length})</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {agvs.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No AGVs spawned.</p>
                    ) : (
                        agvs.map(agv => (
                            <button
                                key={agv.id}
                                onClick={() => onSelectAgv(agv.id)}
                                className={`w-full text-left px-3 py-2 rounded flex items-center justify-between text-sm transition-colors ${
                                    selectedAgvId === agv.id 
                                        ? 'bg-blue-900/50 border border-blue-700 text-white' 
                                        : 'bg-gray-700/50 hover:bg-gray-700 text-gray-300 border border-transparent'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agv.color }} />
                                    <span>AGV-{agv.id.toString().slice(-4)}</span>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    agv.status === 'MOVING' ? 'bg-green-900 text-green-400' :
                                    agv.status === 'WAITING' ? 'bg-red-900 text-red-400' :
                                    agv.status === 'REPATHING' ? 'bg-yellow-900 text-yellow-400' :
                                    'bg-gray-800 text-gray-500'
                                }`}>
                                    {agv.status}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
