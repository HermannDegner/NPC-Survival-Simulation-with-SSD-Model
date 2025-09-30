import React, { useState, useEffect, useRef, useCallback } from 'react';
import ControlPanel from './components/ControlPanel';
import NPCStatusPanel from './components/NPCStatusPanel';
import SimulationMap from './components/SimulationMap';
import Charts from './components/Charts';
import EventLog from './components/EventLog';
import type { NPCState, LogEntry, Berry, HuntZone } from './types';
import { SimulationService } from './services/simulationService';
import { TICKS, NPC_PRESETS } from './constants';
import { LocalizationProvider } from './contexts/LocalizationContext';

const AppContent: React.FC = () => {
    const [npcs, setNpcs] = useState<NPCState[]>([]);
    const [logData, setLogData] = useState<LogEntry[]>([]);
    const [tick, setTick] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [speed, setSpeed] = useState(20);
    const [berries, setBerries] = useState<Record<string, Berry>>({});
    const [huntZones, setHuntZones] = useState<Record<string, HuntZone>>({});

    const simulationServiceRef = useRef<SimulationService | null>(null);
    const intervalRef = useRef<number | null>(null);

    const resetSimulation = useCallback(() => {
        if (!simulationServiceRef.current) {
            simulationServiceRef.current = new SimulationService();
        }
        const { initialNpcs, initialEnv } = simulationServiceRef.current.reset();
        setNpcs([...initialNpcs]);
        setBerries(initialEnv.berries);
        setHuntZones(initialEnv.huntZones);
        setLogData([]);
        setTick(0);
        setIsRunning(false);
    }, []);

    useEffect(() => {
        resetSimulation();
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [resetSimulation]);
    
    const runTick = useCallback(() => {
        if (simulationServiceRef.current) {
            const { updatedNpcs, newLogEntries, updatedEnv } = simulationServiceRef.current.runTick(tick + 1);
            setNpcs([...updatedNpcs]);
            setLogData(prev => [...prev, ...newLogEntries]);
            setBerries(updatedEnv.berries);
            setHuntZones(updatedEnv.huntZones);
            setTick(prev => prev + 1);
        }
    }, [tick]);

    useEffect(() => {
        if (isRunning) {
            if (tick >= TICKS) {
                setIsRunning(false);
                return;
            }
            intervalRef.current = window.setInterval(runTick, 1000 / (speed / 10));
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, speed, tick, runTick]);

    const handleStartPause = () => {
        if (tick >= TICKS) return;
        setIsRunning(!isRunning);
    };

    const handleReset = () => {
        setIsRunning(false);
        setTimeout(() => {
            resetSimulation();
        }, 100);
    };



    const handleSpeedChange = (newSpeed: number) => {
        setSpeed(newSpeed);
    };
    
    const npcNames = Object.keys(NPC_PRESETS);

    return (
        <main className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="container mx-auto max-w-7xl">
                <header className="mb-6">
                    <h1 className="text-4xl font-bold text-cyan-400">NPC Survival Simulation</h1>
                    <p className="text-gray-400 mt-1">Agent-Based Model with Subjective State Dynamics (SSD)</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <ControlPanel
                            isRunning={isRunning}
                            onStartPause={handleStartPause}
                            onReset={handleReset}
                            speed={speed}
                            onSpeedChange={handleSpeedChange}
                            tick={tick}
                            maxTicks={TICKS}
                        />
                        <NPCStatusPanel npcs={npcs} />
                    </div>

                    {/* Middle Column */}
                    <div className="lg:col-span-1">
                        <SimulationMap npcs={npcs} berries={berries} huntZones={huntZones} />
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <EventLog logData={logData} />
                         <Charts logData={logData} npcNames={npcNames} />
                    </div>
                </div>
            </div>
        </main>
    );
};


const App: React.FC = () => {
    return (
        <LocalizationProvider>
            <AppContent />
        </LocalizationProvider>
    );
};

export default App;