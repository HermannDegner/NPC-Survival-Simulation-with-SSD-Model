export interface Position {
    x: number;
    y: number;
}

export interface NPCPreset {
    risk_tolerance: number;
    curiosity: number;
    avoidance: number;
    stamina: number;
    empathy: number;
    color: string;
}

export interface LogEntry {
    t: number;
    name: string;
    state: string;
    action: string;
    target?: string;
    amount?: number;
    hunger: number;
    fatigue: number;
    injury: number;
    E: number;
    T?: number;
    kappa_forage?: number;
    kappa_rest?: number;
    kappa_help?: number;
    kappa_hunt?: number;
    jump_rate?: number;
    Theta?: number;
    boredom?: number;
}

export interface NPCState {
    name: string;
    x: number;
    y: number;
    hunger: number;
    fatigue: number;
    injury: number;
    alive: boolean;
    state: string;
    E: number;
    T: number;
    preset: NPCPreset;
    kappa: { [key: string]: number };
}