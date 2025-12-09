import React from 'react';
import { MousePointer2, MapPin, Play, Settings } from 'lucide-react';

const TutorialCard: React.FC = () => {
    return (
        <div className="absolute top-4 left-4 w-64 bg-gray-900/40 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 text-white shadow-lg pointer-events-none select-none z-10">
            <h3 className="text-sm font-bold text-blue-400 mb-3 uppercase tracking-wider border-b border-gray-700/50 pb-2">
                Quick Guide
            </h3>
            
            <div className="space-y-3 text-xs text-gray-300">
                <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400 mt-0.5">
                        <MousePointer2 size={14} />
                    </div>
                    <div>
                        <strong className="text-gray-100 block mb-0.5">Select AGV</strong>
                        Click on any AGV to view its status and telemetry.
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-green-500/20 rounded-lg text-green-400 mt-0.5">
                        <MapPin size={14} />
                    </div>
                    <div>
                        <strong className="text-gray-100 block mb-0.5">Set Destination</strong>
                        With an AGV selected, <span className="text-white font-bold">click any node</span> to set a new target.
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-purple-500/20 rounded-lg text-purple-400 mt-0.5">
                        <Play size={14} />
                    </div>
                    <div>
                        <strong className="text-gray-100 block mb-0.5">Simulation</strong>
                        Use controls to Play/Pause, Spawn AGVs, or Randomize the map.
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-orange-500/20 rounded-lg text-orange-400 mt-0.5">
                        <Settings size={14} />
                    </div>
                    <div>
                        <strong className="text-gray-100 block mb-0.5">Config</strong>
                        Adjust speed and safety settings in the right panel.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TutorialCard;
