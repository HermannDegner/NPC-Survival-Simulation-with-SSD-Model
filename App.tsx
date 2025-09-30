import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EnvScarce, NPCWithSSD } from './services/simulationService';
import { NPC_PRESETS, TICKS, ENV_SIZE } from './constants';
import type { LogEntry, NPCState, Position } from './types';
import SimulationMap from './components/SimulationMap';
import ControlPanel from './components/ControlPanel';
import NPCStatusPanel from './components/NPCStatusPanel';
import Charts from './components/Charts';
import EventLog from './components/EventLog';
import { initialRoster, initializeEnv } from './services/simulationService';

const App: React.FC = () => {
    const [tick, setTick] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [speed, setSpeed] = useState(50);
    const [npcStates, setNpcStates] = useState<NPCState[]>([]);
    const [logData, setLogData] = useState<LogEntry[]>([]);
    const [envBerries, setEnvBerries] = useState<Map<string, { abundance: number }>>(new Map());
    const [envHunts, setEnvHunts] = useState<Map<string, { isUnsafe: boolean }>>(new Map());

    const simulationRef = useRef<{ env: EnvScarce; roster: Record<string, NPCWithSSD> } | null>(null);
    // FIX: Initialize useRef with an explicit undefined value to resolve "Expected 1 arguments, but got 0" error.
    const animationFrameId = useRef<number | undefined>(undefined);

    const resetSimulation = useCallback(() => {
        console.log("Resetting simulation...");
        setIsRunning(false);
        setTick(0);
        
        const env = initializeEnv();
        const roster = initialRoster(env);

        simulationRef.current = { env, roster };
        
        const initialNpcStates = Object.values(roster).map((npc: NPCWithSSD) => npc.getFullState());
        setNpcStates(initialNpcStates);
        setLogData([]);
        
        const berryMap = new Map<string, { abundance: number }>();
        Object.entries(env.berries).forEach(([key, value]) => berryMap.set(key, { abundance: (value as { abundance: number }).abundance }));
        setEnvBerries(berryMap);
        
        const huntMap = new Map<string, { isUnsafe: boolean }>();
        Object.keys(env.huntzones).forEach(key => huntMap.set(key, { isUnsafe: false }));
        setEnvHunts(huntMap);
    }, [setIsRunning, setTick, setNpcStates, setLogData, setEnvBerries, setEnvHunts]);

    useEffect(() => {
        resetSimulation();
    }, [resetSimulation]);
    
    const runSimulationStep = useCallback(() => {
        if (!simulationRef.current) return;

        const { env, roster } = simulationRef.current;
        
        Object.values(roster).forEach((npc: NPCWithSSD) => npc.step(tick));
        env.step();

        const newLogs = Object.values(roster).flatMap((npc: NPCWithSSD) => npc.flushLog());
        setLogData(prevLogs => [...prevLogs, ...newLogs]);
        setNpcStates(Object.values(roster).map((npc: NPCWithSSD) => npc.getFullState()));
        
        const berryMap = new Map<string, { abundance: number }>();
        Object.entries(env.berries).forEach(([key, value]) => berryMap.set(key, { abundance: (value as { abundance: number }).abundance }));
        setEnvBerries(berryMap);

        const huntMap = new Map<string, { isUnsafe: boolean }>();
        const UNSAFE_DURATION = 20;
        Object.entries(env.huntzones).forEach(([key, value]) => {
            const zone = value as { last_injury_tick?: number };
            const isUnsafe = zone.last_injury_tick !== undefined && tick >= zone.last_injury_tick && tick < zone.last_injury_tick + UNSAFE_DURATION;
            huntMap.set(key, { isUnsafe });
        });
        setEnvHunts(huntMap);

        setTick(prevTick => prevTick + 1);
    }, [tick]);

    useEffect(() => {
        if (isRunning && tick < TICKS) {
            const interval = Math.max(10, 200 - speed * 2);
            const timer = setTimeout(() => {
                animationFrameId.current = requestAnimationFrame(runSimulationStep);
            }, interval);
            return () => clearTimeout(timer);
        }
        if (tick >= TICKS) {
            setIsRunning(false);
        }
    }, [isRunning, tick, speed, runSimulationStep]);


    const handleStartPause = () => {
        setIsRunning(prev => !prev);
    };

    const handleReset = () => {
        if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        resetSimulation();
    };

    const handleSpeedChange = (newSpeed: number) => {
        setSpeed(newSpeed);
    };

    const berryDataForMap = Array.from(envBerries.entries()).map(([key, value]) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y, abundance: value.abundance };
    });

    const huntDataForMap = Array.from(envHunts.entries()).map(([key, value]) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y, isUnsafe: value.isUnsafe };
    });
    
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4">
            <header className="text-center mb-4">
                <h1 className="text-3xl font-bold text-cyan-400">NPC Survival Simulation</h1>
                <p className="text-gray-400">Agent-Based Model with Subjective State Dynamics (SSD)</p>
            </header>
            
            <main className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <ControlPanel 
                        isRunning={isRunning}
                        onStartPause={handleStartPause}
                        onReset={handleReset}
                        speed={speed}
                        onSpeedChange={handleSpeedChange}
                        tick={tick}
                        maxTicks={TICKS}
                    />
                    <SimulationMap 
                        size={ENV_SIZE}
                        npcs={npcStates}
                        berries={berryDataForMap}
                        huntZones={huntDataForMap}
                    />
                    <NPCStatusPanel npcs={npcStates} />
                </div>

                <div className="lg:col-span-2 flex flex-col gap-4">
                   <Charts logData={logData} npcNames={Object.keys(NPC_PRESETS)} />
                   <EventLog logData={logData} />
                </div>
            </main>
        </div>
    );
};

export default App;