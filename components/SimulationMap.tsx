import React from 'react';
import type { NPCState, Position } from '../types';

interface BerryState {
    x: number;
    y: number;
    abundance: number;
}
interface HuntZoneState {
    x: number;
y: number;
    isUnsafe: boolean;
}

interface SimulationMapProps {
    size: number;
    npcs: NPCState[];
    berries: BerryState[];
    huntZones: HuntZoneState[];
}

const NpcIcon: React.FC<{ npc: NPCState }> = ({ npc }) => (
    <div className={`absolute w-3 h-3 rounded-full flex items-center justify-center border-2 border-gray-800 ${npc.alive ? '' : 'grayscale'}`} style={{
        left: `${(npc.x / 26) * 100}%`,
        top: `${(npc.y / 26) * 100}%`,
        transform: 'translate(-50%, -50%)',
        transition: 'left 0.2s linear, top 0.2s linear',
    }}>
        <span className={`${npc.preset.color} font-bold text-xs`}>{npc.name.charAt(npc.name.length-1)}</span>
    </div>
);


const SimulationMap: React.FC<SimulationMapProps> = ({ size, npcs, berries, huntZones }) => {
    const DEPLETION_THRESHOLD = 0.1;
    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-2 text-cyan-300">Environment Map</h2>
            <div className="relative aspect-square bg-gray-700/50 rounded-md overflow-hidden border-2 border-gray-700">
                {/* Grid Lines */}
                <div className="absolute inset-0 grid grid-cols-13">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={`v-${i}`} className="border-r border-gray-600/50"></div>
                    ))}
                </div>
                <div className="absolute inset-0 grid grid-rows-13">
                     {Array.from({ length: 12 }).map((_, i) => (
                        <div key={`h-${i}`} className="border-b border-gray-600/50"></div>
                    ))}
                </div>

                {/* Berries */}
                {berries.map((berry, i) => (
                    <div key={`berry-${i}`} className="absolute w-2 h-2 bg-pink-500 rounded-full transition-opacity duration-300"
                         style={{ 
                             left: `${(berry.x / size) * 100}%`, 
                             top: `${(berry.y / size) * 100}%`, 
                             transform: 'translate(-50%, -50%)',
                             opacity: berry.abundance < DEPLETION_THRESHOLD ? 0.3 : 1
                          }}
                    ></div>
                ))}

                {/* Hunt Zones */}
                {huntZones.map((zone, i) => (
                    <div key={`hunt-${i}`} className={`absolute w-3 h-3 border-2 transition-colors duration-300 ${zone.isUnsafe ? 'border-yellow-400' : 'border-red-500'}`}
                         style={{ 
                            left: `${(zone.x / size) * 100}%`, 
                            top: `${(zone.y / size) * 100}%`, 
                            transform: 'translate(-50%, -50%) rotate(45deg)' 
                        }}
                    ></div>
                ))}
                
                {/* NPCs */}
                {npcs.map(npc => (
                    <NpcIcon key={npc.name} npc={npc} />
                ))}
            </div>
             <div className="flex justify-around mt-2 text-xs text-gray-400">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-pink-500"></div> Berry (Dim=Depleted)</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 border border-yellow-400 transform rotate-45"></div> Hunt (Yellow=Unsafe)</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border border-gray-300"></div> NPC</div>
            </div>
        </div>
    );
};

export default SimulationMap;