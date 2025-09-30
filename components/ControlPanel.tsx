import React from 'react';

interface ControlPanelProps {
    isRunning: boolean;
    onStartPause: () => void;
    onReset: () => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
    tick: number;
    maxTicks: number;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ isRunning, onStartPause, onReset, speed, onSpeedChange, tick, maxTicks }) => {
    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-3 text-cyan-300">Controls</h2>
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={onStartPause}
                    className={`px-4 py-2 rounded-md font-semibold text-white transition-colors w-24 ${isRunning ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {isRunning ? 'Pause' : 'Start'}
                </button>
                <button
                    onClick={onReset}
                    className="px-4 py-2 rounded-md font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors w-24"
                >
                    Reset
                </button>
            </div>
            <div className="mb-4">
                <label htmlFor="speed" className="block text-sm font-medium text-gray-300 mb-1">Speed</label>
                <input
                    type="range"
                    id="speed"
                    min="1"
                    max="100"
                    value={speed}
                    onChange={(e) => onSpeedChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Progress</label>
                <div className="w-full bg-gray-700 rounded-full h-4">
                    <div
                        className="bg-cyan-500 h-4 rounded-full transition-all duration-200"
                        style={{ width: `${(tick / maxTicks) * 100}%` }}
                    ></div>
                </div>
                <p className="text-center text-sm mt-1 text-gray-400">Tick: {tick} / {maxTicks}</p>
            </div>
        </div>
    );
};

export default ControlPanel;