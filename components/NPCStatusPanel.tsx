import React from 'react';
import type { NPCState } from '../types';
import { useTranslation } from '../contexts/LocalizationContext';

interface NPCStatusPanelProps {
    npcs: NPCState[];
}

const StatusBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
    <div className="w-full bg-gray-600 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }}></div>
    </div>
);

const NPCStatusCard: React.FC<{ npc: NPCState }> = ({ npc }) => {
    const { t } = useTranslation();
    const hungerColor = npc.hunger > 80 ? 'bg-red-500' : npc.hunger > 55 ? 'bg-yellow-500' : 'bg-green-500';
    const fatigueColor = npc.fatigue > 80 ? 'bg-indigo-400' : npc.fatigue > 50 ? 'bg-indigo-600' : 'bg-indigo-800';
    const injuryColor = npc.injury > 50 ? 'bg-red-600' : npc.injury > 20 ? 'bg-orange-500' : 'bg-gray-700';
    const sleepDebtColor = npc.sleep_debt > 150 ? 'bg-purple-500' : npc.sleep_debt > 80 ? 'bg-purple-700' : 'bg-purple-900';
    
    return (
        <div className={`p-3 rounded-lg ${npc.alive ? 'bg-gray-700/80' : 'bg-red-900/50 grayscale'}`}>
            <div className="flex justify-between items-center mb-2">
                <h4 className={`font-bold ${npc.preset.color}`}>{npc.name}</h4>
                {npc.is_sleeping ? (
                     <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-900 text-blue-300`}>
                        {t('status.sleeping')}
                    </span>
                ) : (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${npc.alive ? 'bg-green-800 text-green-300' : 'bg-red-800 text-red-300'}`}>
                        {npc.alive ? t('status.alive') : t('status.dead')}
                    </span>
                )}
            </div>
            <div className="space-y-2 text-xs">
                <div>
                    <div className="flex justify-between mb-0.5"><span className="text-gray-400">{t('status.hunger')}</span><span>{npc.hunger.toFixed(0)}</span></div>
                    <StatusBar value={npc.hunger} max={100} color={hungerColor} />
                </div>
                 <div>
                    <div className="flex justify-between mb-0.5"><span className="text-gray-400">{t('status.fatigue')}</span><span>{npc.fatigue.toFixed(0)}</span></div>
                    <StatusBar value={npc.fatigue} max={100} color={fatigueColor} />
                </div>
                 <div>
                    <div className="flex justify-between mb-0.5"><span className="text-gray-400">{t('status.injury')}</span><span>{npc.injury.toFixed(0)}</span></div>
                    <StatusBar value={npc.injury} max={100} color={injuryColor} />
                </div>
                 <div>
                    <div className="flex justify-between mb-0.5"><span className="text-gray-400">{t('status.sleepDebt')}</span><span>{npc.sleep_debt.toFixed(0)}</span></div>
                    <StatusBar value={npc.sleep_debt} max={200} color={sleepDebtColor} />
                </div>
                <div className="pt-1 flex justify-between text-gray-400">
                    <span>E: <span className="text-gray-200 font-mono">{npc.E.toFixed(2)}</span></span>
                    <span>T: <span className="text-gray-200 font-mono">{npc.T.toFixed(2)}</span></span>
                </div>
            </div>
        </div>
    );
}

const NPCStatusPanel: React.FC<NPCStatusPanelProps> = ({ npcs }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-3 text-cyan-300">{t('status.title')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {npcs.map(npc => (
                    <NPCStatusCard key={npc.name} npc={npc} />
                ))}
            </div>
        </div>
    );
};

export default NPCStatusPanel;