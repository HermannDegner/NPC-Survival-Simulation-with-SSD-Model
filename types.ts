import type { ChartData as ChartJsChartData } from 'chart.js';

export interface Coords {
    x: number;
    y: number;
}

export interface EnvNode {
    food: number;
    danger: number;
    explored: { [npcName: string]: boolean };
}

export type Environment = EnvNode[][];

export interface NPCPreset {
    risk_tolerance: number;
    curiosity: number;
    avoidance: number;
    stamina: number;
    empathy: number;
    color: string;
}

export interface NPCState {
    name: string;
    preset: NPCPreset;
    alive: boolean;
    hunger: number;
    fatigue: number;
    injury: number;
    x: number;
    y: number;
    goal: string;
    path: Coords[];
    memory: { [key: string]: Coords }; // e.g. 'food_source', 'home'
    relationships: { [npcName: string]: number }; // Simplified to store 'rel' value directly
    E: number; // Unprocessed meaning pressure (Heat)
    T: number; // Exploration temperature
    
    // Circadian rhythm properties
    is_sleeping: boolean;
    sleep_debt: number;
    kappa: { [key: string]: number };
    boredom: number;
}

export interface LogEntry {
    t: number;
    name: string;
    action: string;
    target?: string;
    amount?: number;
    details?: string;
    time_of_day?: string;
    wake_reason?: string;
    sleep_debt?: number;
}

export interface DayNightState {
    tick: number;
    day: number;
    phase: string;
    isNight: boolean;
    lightLevel: number;
}

export interface SimulationState {
    npcs: NPCState[];
    env: Environment;
    log: LogEntry[];
    tick: number;
    dayNight: DayNightState;
}

export interface ChartData {
    labels: (string | number)[];
    datasets: {
        label:string;
        data: number[];
        borderColor: string;
        backgroundColor: string;
        fill?: boolean;
        yAxisID?: string;
    }[];
}


export interface SocialGraphData {
    nodes: { id: string; label: string; color: string; alive: boolean }[];
    links: { source: string; target: string; value: number }[];
}