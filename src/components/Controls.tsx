import React from 'react';
import { Play, Pause, Plus, RefreshCw, Dice5, Shuffle, Move } from 'lucide-react';

interface ControlsProps {
    isPlaying: boolean;
    onTogglePlay: () => void;
    onSpawnAgv: () => void;
    onRegenerateMap: () => void;
    onRandomizeSeed: () => void;
    randomMoveMode: boolean;
    onToggleRandomMove: () => void;
    onResetView: () => void;
    seed: string;
    onSeedChange: (seed: string) => void;
    nodeCount: number;
    onNodeCountChange: (count: number) => void;
}

const Controls: React.FC<ControlsProps> = ({
    isPlaying,
    onTogglePlay,
    onSpawnAgv,
    onRegenerateMap,
    onRandomizeSeed,
    randomMoveMode,
    onToggleRandomMove,
    onResetView,
    seed,
    onSeedChange,
    nodeCount,
    onNodeCountChange
}) => {
    return (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800/90 backdrop-blur border border-gray-700 rounded-xl p-2 flex items-center gap-2 shadow-xl">
            <button 
                onClick={onTogglePlay}
                className={`p-3 rounded-lg flex items-center gap-2 font-bold transition-colors ${isPlaying ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}
            >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>

            <button 
                onClick={onToggleRandomMove}
                className={`p-3 rounded-lg transition-colors ${randomMoveMode ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'}`}
                title="Toggle Auto-Pilot"
            >
                <Shuffle size={20} />
            </button>

            <div className="w-px h-8 bg-gray-700 mx-2" />

            <button 
                onClick={onSpawnAgv}
                className="p-3 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex items-center gap-2 font-bold"
                title="Spawn AGV"
            >
                <Plus size={20} />
                <span>SPAWN AGV</span>
            </button>



            <div className="w-px h-8 bg-gray-700 mx-2" />



            {/* Map Settings Inputs */}
            <div className="flex items-center gap-2 px-2">
                <div className="flex flex-col gap-1">
                    <input 
                        type="text"
                        value={seed}
                        onChange={(e) => onSeedChange(e.target.value)}
                        className="w-24 bg-gray-700 text-white px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-xs"
                        placeholder="Seed"
                    />
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">Nodes:</span>
                        <input 
                            type="number" min="5" max="200" step="1"
                            value={nodeCount}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) onNodeCountChange(Math.min(200, Math.max(5, val)));
                            }}
                            className="w-12 bg-gray-700 text-white px-1 py-0.5 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-xs text-center"
                        />
                    </div>
                </div>
            </div>
            
            <div className="w-px h-8 bg-gray-700 mx-2" />

            <button 
                onClick={onRegenerateMap}
                className="p-3 rounded-lg bg-gray-700/50 text-gray-400 hover:bg-gray-700 transition-colors"
                title="Regenerate Map Layout"
            >
                <RefreshCw size={20} />
            </button>

            <button 
                onClick={onRandomizeSeed}
                className="p-3 rounded-lg bg-gray-700/50 text-gray-400 hover:bg-gray-700 transition-colors"
                title="New Random Seed"
            >
                <Dice5 size={20} />
            </button>

            <button 
                onClick={onResetView}
                className="p-3 rounded-lg bg-gray-700/50 text-gray-400 hover:bg-gray-700 transition-colors"
                title="Reset View"
            >
                <Move size={20} />
            </button>
        </div>
    );
};

export default Controls;
