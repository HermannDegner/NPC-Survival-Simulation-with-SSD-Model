import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ControlPanel from './components/ControlPanel';
import SimulationMap from './components/SimulationMap';
import NPCStatusPanel from './components/NPCStatusPanel';
import EventLog from './components/EventLog';
import Charts from './components/Charts';
import SocialNetworkGraph from './components/SocialNetworkGraph';
import { initializeSimulation, updateSimulation } from './services/simulationService';
import type { SimulationState, ChartData, SocialGraphData } from './types';
import { TICKS } from './constants';
import { LocalizationProvider, useTranslation } from './contexts/LocalizationContext';

const AppContent: React.FC = () => {
    const [simulationState, setSimulationState] = useState<SimulationState>(initializeSimulation);
    const [isRunning, setIsRunning] = useState(false);
    const [speed, setSpeed] = useState(50);
    const timerRef = useRef<number | null>(null);

    const resetSimulation = useCallback(() => {
        setIsRunning(false);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setSimulationState(initializeSimulation());
        setChartHistory([]);
        setSleepDebtHistory({});
    }, []);
    
    const runTick = useCallback(() => {
        setSimulationState(prevState => {
            if (prevState.tick >= TICKS) {
                setIsRunning(false);
                return prevState;
            }
            return updateSimulation(prevState);
        });
    }, []);

    useEffect(() => {
        if (isRunning && simulationState.tick < TICKS) {
            timerRef.current = window.setTimeout(runTick, 200 - speed * 1.9);
        } else if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isRunning, speed, runTick, simulationState.tick]);

    const handleStartPause = () => {
        setIsRunning(prev => !prev);
    };

    const handleSpeedChange = (newSpeed: number) => {
        setSpeed(newSpeed);
    };

    // --- Chart Data Management ---
    const [chartHistory, setChartHistory] = useState<{tick: number; alive: number}[]>([]);
    const [sleepDebtHistory, setSleepDebtHistory] = useState<Record<string, {tick: number, debt: number}[]>>({});

    useEffect(() => {
        if (simulationState.tick % 5 === 0 || !isRunning) {
             setChartHistory(prev => [...prev, {
                tick: simulationState.tick,
                alive: simulationState.npcs.filter(n => n.alive).length,
            }]);
            
            const newSleepDebtHistory = {...sleepDebtHistory};
            simulationState.npcs.forEach(npc => {
                if(!newSleepDebtHistory[npc.name]) newSleepDebtHistory[npc.name] = [];
                newSleepDebtHistory[npc.name].push({tick: simulationState.tick, debt: npc.sleep_debt});
            });
            setSleepDebtHistory(newSleepDebtHistory);
        }
    }, [simulationState.tick, isRunning]); // dependencies simplified

    const populationData: ChartData = useMemo(() => ({
        labels: chartHistory.map(h => h.tick),
        datasets: [
            {
                label: 'Alive NPCs',
                data: chartHistory.map(h => h.alive),
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
            },
        ],
    }), [chartHistory]);

    const sleepDebtData: ChartData = useMemo(() => ({
        labels: sleepDebtHistory[simulationState.npcs[0]?.name]?.map(h => h.tick) || [],
        datasets: simulationState.npcs.map(npc => ({
            label: npc.name,
            data: sleepDebtHistory[npc.name]?.map(h => h.debt) || [],
            borderColor: npc.preset.color.replace('text-', 'rgb(').replace('400', ')').replace('green', '74, 222, 128').replace('blue', '96, 165, 250').replace('yellow', '250, 204, 21').replace('purple', '168, 85, 247').replace('orange', '251, 146, 60'),
            backgroundColor: 'transparent',
        })),
    }), [sleepDebtHistory, simulationState.npcs]);


    const socialGraphData: SocialGraphData = useMemo(() => {
        const links: { source: string; target: string; value: number }[] = [];
        const addedLinks = new Set<string>();

        simulationState.npcs.forEach(npc => {
            Object.keys(npc.relationships).forEach(targetName => {
                const pairKey1 = `${npc.name}-${targetName}`;
                const pairKey2 = `${targetName}-${npc.name}`;
                if (!addedLinks.has(pairKey1) && !addedLinks.has(pairKey2)) {
                    links.push({
                        source: npc.name,
                        target: targetName,
                        value: npc.relationships[targetName],
                    });
                    addedLinks.add(pairKey1);
                }
            });
        });

        return {
            nodes: simulationState.npcs.map(npc => ({
                id: npc.name,
                label: npc.name,
                color: npc.preset.color,
                alive: npc.alive,
            })),
            links: links
        }
    }, [simulationState.npcs]);
    
    const { t, setLanguage, language } = useTranslation();

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans p-4 lg:p-6">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-center text-cyan-300 tracking-wider">
                    {t('title')}
                </h1>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-sm rounded ${language === 'en' ? 'bg-cyan-500 text-white' : 'bg-gray-700'}`}>EN</button>
                    <button onClick={() => setLanguage('ja')} className={`px-3 py-1 text-sm rounded ${language === 'ja' ? 'bg-cyan-500 text-white' : 'bg-gray-700'}`}>JA</button>
                </div>
            </header>
            <main className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
                <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-4 lg:gap-6">
                    <ControlPanel
                        isRunning={isRunning}
                        onStartPause={handleStartPause}
                        onReset={resetSimulation}
                        speed={speed}
                        onSpeedChange={handleSpeedChange}
                        tick={simulationState.tick}
                        maxTicks={TICKS}
                        dayNight={simulationState.dayNight}
                    />
                    <NPCStatusPanel npcs={simulationState.npcs} />
                </div>
                <div className="lg:col-span-2 xl:col-span-3">
                    {simulationState.env && (
                         <SimulationMap env={simulationState.env} npcs={simulationState.npcs} dayNight={simulationState.dayNight} />
                    )}
                </div>
                <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-4 lg:gap-6">
                    <EventLog logData={simulationState.log} />
                    <Charts populationData={populationData} sleepDebtData={sleepDebtData} />
                     <SocialNetworkGraph data={socialGraphData} />
                </div>
            </main>
        </div>
    );
};

const App: React.FC = () => (
    <LocalizationProvider>
        <AppContent />
    </LocalizationProvider>
);


export default App;