import React from 'react';
import type { Environment, NPCState, DayNightState } from '../types';
import { ENV_SIZE } from '../constants';

interface SimulationMapProps {
    env: Environment;
    npcs: NPCState[];
    dayNight: DayNightState;
}

const SimulationMap: React.FC<SimulationMapProps> = ({ env, npcs, dayNight }) => {

    const getBgColor = (food: number, danger: number) => {
        const green = Math.min(255, 50 + food * 2);
        const red = Math.min(255, 50 + danger * 4);
        return `rgb(${red}, ${green}, 50)`;
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg relative aspect-square">
            <div 
                className="grid bg-gray-900/50"
                style={{
                    gridTemplateColumns: `repeat(${ENV_SIZE}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${ENV_SIZE}, minmax(0, 1fr))`,
                    width: '100%',
                    height: '100%',
                }}
            >
                {env.map((row, y) =>
                    row.map((cell, x) => (
                        <div
                            key={`${x}-${y}`}
                            className="border border-gray-700/50"
                            style={{ backgroundColor: getBgColor(cell.food, cell.danger) }}
                        ></div>
                    ))
                )}
            </div>
            {/* Day/Night Overlay */}
            <div 
                className="absolute top-0 left-0 w-full h-full pointer-events-none transition-colors duration-1000"
                style={{
                    backgroundColor: `rgba(25, 25, 112, ${0.7 * (1 - dayNight.lightLevel)})`,
                    mixBlendMode: 'multiply'
                }}
            ></div>

            {npcs.filter(npc => npc.alive).map(npc => (
                <div
                    key={npc.name}
                    className={`absolute w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ease-in-out transform -translate-x-1/2 -translate-y-1/2 border-2 border-white/50`}
                    style={{
                        left: `${(npc.x + 0.5) / ENV_SIZE * 100}%`,
                        top: `${(npc.y + 0.5) / ENV_SIZE * 100}%`,
                        backgroundColor: 'rgba(50,50,50,0.7)'
                    }}
                    title={npc.name}
                >
                    <span className={npc.preset.color}>{npc.name.split('_')[1]}</span>
                </div>
            ))}
        </div>
    );
};

export default SimulationMap;