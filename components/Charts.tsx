import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { LogEntry } from '../types';
import { NPC_PRESETS } from '../constants';

interface ChartsProps {
    logData: LogEntry[];
    npcNames: string[];
}

type ChartType = 'hunger' | 'E' | 'T' | 'kappa_forage' | 'kappa_hunt';

const chartConfigs: Record<ChartType, { title: string; yLabel: string; key: keyof LogEntry; domain?: [number | string, number | string] }> = {
    hunger: { title: "Hunger Over Time", yLabel: "Hunger", key: 'hunger', domain: [0, 120] },
    E: { title: "Heat Accumulation (E)", yLabel: "Unprocessed Pressure (E)", key: 'E', domain: [0, 'auto'] },
    T: { title: "Exploration Temperature (T)", yLabel: "Temperature (T)", key: 'T', domain: [0, 1] },
    kappa_forage: { title: "Alignment Inertia (Forage)", yLabel: "κ (forage)", key: 'kappa_forage', domain: [0, 'auto'] },
    kappa_hunt: { title: "Alignment Inertia (Hunt)", yLabel: "κ (hunt)", key: 'kappa_hunt', domain: [0, 'auto'] }
};


const Charts: React.FC<ChartsProps> = ({ logData, npcNames }) => {
    const [activeChart, setActiveChart] = useState<ChartType>('hunger');
    
    const colors = useMemo(() => npcNames.map(name => NPC_PRESETS[name]?.color.replace('text-', '').replace('-400', '') || 'gray'), [npcNames]);

    const chartData = useMemo(() => {
        const dataByTick: { [key: number]: any } = {};
        logData.forEach(entry => {
            if (!dataByTick[entry.t]) {
                dataByTick[entry.t] = { t: entry.t };
            }
            if (entry[activeChart] !== undefined) {
                 dataByTick[entry.t][entry.name] = entry[activeChart];
            }
        });

        // Forward fill missing data points for smoother lines
        let lastValues: { [key: string]: number } = {};
        return Object.values(dataByTick).sort((a, b) => a.t - b.t).map(tickData => {
            npcNames.forEach(name => {
                if (tickData[name] === undefined) {
                    tickData[name] = lastValues[name];
                } else {
                    lastValues[name] = tickData[name];
                }
            });
            return tickData;
        });
    }, [logData, activeChart, npcNames]);
    
    const deathEvents = useMemo(() => {
        return logData.filter(log => log.action === 'death');
    }, [logData]);

    const config = chartConfigs[activeChart];

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-cyan-300">{config.title}</h2>
                 <div className="flex flex-wrap space-x-1 p-1 bg-gray-700 rounded-md">
                    {Object.keys(chartConfigs).map((key) => (
                        <button 
                            key={key} 
                            onClick={() => setActiveChart(key as ChartType)}
                            className={`px-3 py-1 text-xs font-semibold rounded ${activeChart === key ? 'bg-cyan-500 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                        >
                            {key.replace('_', ' ').toUpperCase()}
                        </button>
                    ))}
                 </div>
            </div>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                        <XAxis dataKey="t" stroke="#A0AEC0" name="Time" />
                        <YAxis stroke="#A0AEC0" domain={config.domain} label={{ value: config.yLabel, angle: -90, position: 'insideLeft', fill: '#A0AEC0', style: {textAnchor: 'middle'} }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }}
                            labelStyle={{ color: '#E2E8F0' }}
                        />
                        <Legend />
                        {npcNames.map((name, i) => (
                            <Line key={name} type="monotone" dataKey={name} stroke={colors[i]} strokeWidth={2} dot={false} />
                        ))}
                        {activeChart === 'hunger' && <ReferenceLine y={100} label={{ value: "Death Threshold", position: "insideTopRight", fill: "#f56565" }} stroke="#f56565" strokeDasharray="3 3" />}
                        {activeChart === 'hunger' && deathEvents.map(event => (
                            <ReferenceLine key={event.t + event.name} x={event.t} stroke="red" >
                                 <YAxis/>
                            </ReferenceLine>
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default Charts;