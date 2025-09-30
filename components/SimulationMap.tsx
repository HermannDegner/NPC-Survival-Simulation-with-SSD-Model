import React from 'react';
import type { NPCState, Berry, HuntZone } from '../types';
import { ENV_SIZE } from '../constants';

interface SimulationMapProps {
    npcs: NPCState[];
    berries: Record<string, Berry>;
    huntZones: Record<string, HuntZone>;
}

const NPC_ICON_MAP: { [key: string]: string } = {
    "Forager_A": "A",
    "Tracker_B": "B",
    "Pioneer_C": "C",
    "Guardian_D": "D",
    "Scavenger_E": "E",
};

const SimulationMap: React.FC<SimulationMapProps> = ({ npcs, berries, huntZones }) => {
    
    const posToString = (x: number, y: number) => `${x},${y}`;

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
             <h2 className="text-xl font-bold mb-3 text-cyan-300">Environment Map</h2>
            <div className="grid border-gray-700 border-t border-l" style={{ gridTemplateColumns: `repeat(${ENV_SIZE}, minmax(0, 1fr))` }}>
                {Array.from({ length: ENV_SIZE }, (_, y) =>
                    Array.from({ length: ENV_SIZE }, (_, x) => {
                        const key = `${x}-${y}`;
                        const posKey = posToString(x,y);
                        
                        const npc = npcs.find(n => n.alive && n.x === x && n.y === y);
                        const berry = berries[posKey];
                        const huntZone = huntZones[posKey];
                        
                        let cellContent = null;
                        if (npc) {
                            cellContent = (
                                <div title={npc.name} className={`w-full h-full flex items-center justify-center font-bold text-lg ${npc.preset.color}`}>
                                    {NPC_ICON_MAP[npc.name]?.charAt(0) || '?'}
                                </div>
                            );
                        } else if (berry) {
                            cellContent = <div title="Berry Patch" className="w-3/5 h-3/5 bg-pink-500 rounded-full" style={{opacity: berry.abundance > 0.2 ? 1 : 0.3}}></div>;
                        } else if (huntZone) {
                             cellContent = <div title="Hunt Zone" className="w-4/5 h-4/5 border-2 border-red-500" style={{opacity: huntZone.population > 0.2 ? 1 : 0.3, borderColor: huntZone.unsafe_until > 0 ? 'yellow' : 'rgb(239 68 68)'}}></div>;
                        }
                        
                        return (
                            <div key={key} className="aspect-square bg-gray-900/50 border-r border-b border-gray-700 flex items-center justify-center">
                                {cellContent}
                            </div>
                        );
                    })
                )}
            </div>
             <div className="text-xs text-gray-400 mt-2 grid grid-cols-3 gap-x-2">
                <div><span className="font-bold text-white">A-E</span> = NPC</div>
                <div className="flex items-center"><div className="w-3 h-3 bg-pink-500 rounded-full mr-1.5"></div> Berry (Dim=Depleted)</div>
                <div className="flex items-center"><div className="w-3 h-3 border-2 border-red-500 mr-1.5"></div> Hunt (Yellow=Unsafe)</div>
            </div>
        </div>
    );
};

export default SimulationMap;
