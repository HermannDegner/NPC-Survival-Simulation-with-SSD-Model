import { NPC_PRESETS, ENV_SIZE, DAY_LENGTH } from '../constants';
import type { SimulationState, Environment, NPCState, LogEntry, DayNightState } from '../types';

// --- Day/Night Cycle Logic ---
const NIGHT_START_RATIO = 0.6;
const NIGHT_END_RATIO = 0.9;

class DayNightCycle {
    private tick: number = 0;

    step() {
        this.tick++;
    }
    
    getState(currentTick: number): DayNightState {
        this.tick = currentTick;
        const timeOfDay = (this.tick % DAY_LENGTH) / DAY_LENGTH;
        const isNight = timeOfDay >= NIGHT_START_RATIO;

        let phase = "Afternoon";
        if (timeOfDay < 0.25) phase = "Dawn";
        else if (timeOfDay < 0.5) phase = "Morning";
        else if (timeOfDay >= NIGHT_START_RATIO && timeOfDay < NIGHT_END_RATIO) phase = "Night";
        else if (timeOfDay >= NIGHT_END_RATIO) phase = "Late_Night";
        
        return {
            tick: this.tick,
            day: Math.floor(this.tick / DAY_LENGTH) + 1,
            phase,
            isNight,
            lightLevel: this.getLightLevel(timeOfDay),
        }
    }

    getLightLevel(time: number): number {
        if (time < NIGHT_START_RATIO) {
            const progress = time / NIGHT_START_RATIO;
            return (Math.sin((progress - 0.5) * Math.PI) + 1) / 2;
        } else if (time < NIGHT_END_RATIO) {
            return 0.1;
        } else {
            const progress = (time - NIGHT_END_RATIO) / (1.0 - NIGHT_END_RATIO);
            return progress * 0.3;
        }
    }

    getSleepPressure(time: number): number {
        if (time >= NIGHT_START_RATIO && time < NIGHT_END_RATIO) {
            const nightCenter = (NIGHT_START_RATIO + NIGHT_END_RATIO) / 2;
            const distFromCenter = Math.abs(time - nightCenter);
            const maxDist = (NIGHT_END_RATIO - NIGHT_START_RATIO) / 2;
            return 1.0 - (distFromCenter / maxDist) * 0.5;
        }
        return 0.1;
    }

    getActivityCostMultiplier(time: number): number {
        return 1.0 + (1.0 - this.getLightLevel(time));
    }
    
    getForageSuccessModifier(time: number): number {
        return 0.3 + this.getLightLevel(time) * 0.7;
    }
}
const dayNightCycle = new DayNightCycle();


// --- Environment Logic ---
const initializeEnvironment = (): Environment => {
    const env: Environment = [];
    for (let y = 0; y < ENV_SIZE; y++) {
        const row = [];
        for (let x = 0; x < ENV_SIZE; x++) {
            row.push({
                food: 20 + Math.random() * 40,
                danger: Math.random() * 50,
                explored: {},
            });
        }
        env.push(row);
    }
    // Add some richer patches
    for(let i=0; i<7; i++){
        const x = Math.floor(Math.random() * ENV_SIZE);
        const y = Math.floor(Math.random() * ENV_SIZE);
        env[y][x].food = 60 + Math.random() * 40;
    }
    return env;
};

const updateEnvironment = (env: Environment): Environment => {
    return env.map(row => row.map(cell => ({
        ...cell,
        food: Math.min(100, cell.food + 0.1) // Slow regen
    })));
};

// --- NPC Initialization ---
const initializeNPCs = (): NPCState[] => {
    return Object.keys(NPC_PRESETS).map(name => {
        const preset = NPC_PRESETS[name];
        return {
            name,
            preset,
            alive: true,
            hunger: Math.random() * 20,
            fatigue: Math.random() * 20,
            injury: 0,
            x: Math.floor(ENV_SIZE / 2 + (Math.random() - 0.5) * 8),
            y: Math.floor(ENV_SIZE / 2 + (Math.random() - 0.5) * 8),
            goal: 'explore',
            path: [],
            memory: {},
            relationships: {},
            E: 0.0,
            T: 0.3,
            is_sleeping: false,
            sleep_debt: 0.0,
            kappa: { forage: 0.1, rest: 0.1, help: 0.1 },
            boredom: 0.0,
        };
    });
};

export const initializeSimulation = (): SimulationState => {
    return {
        npcs: initializeNPCs(),
        env: initializeEnvironment(),
        log: [{ t: 0, name: 'System', action: 'Simulation Started' }],
        tick: 0,
        dayNight: dayNightCycle.getState(0),
    };
};

// --- NPC Update Logic ---
// This is a complex class-like structure translated to functional helpers
const NPC_LOGIC = {
    TH_H: 55.0,
    TH_F: 70.0,
    
    // SSD Model constants
    G0: 0.5, g: 0.7, eta: 0.3, lambda_forget: 0.02, rho: 0.1, alpha: 0.6, beta_E: 0.15,
    Theta0: 1.0, a1: 0.5, a2: 0.4, h0: 0.2, gamma: 0.8,
    T0: 0.3, c1: 0.5, c2: 0.6,

    updateKappa(npc: NPCState, action_type: string, success: boolean, reward: number): NPCState {
        const kappa_min = 0.05;
        const kappa_val = npc.kappa[action_type] || kappa_min;
        const work = success ? this.eta * reward : -this.rho * (kappa_val ** 2);
        const decay = this.lambda_forget * (kappa_val - kappa_min);
        npc.kappa[action_type] = Math.max(kappa_min, kappa_val + work - decay);
        return npc;
    },

    updateHeat(npc: NPCState, meaning_pressure: number, processed_amount: number): NPCState {
        const unprocessed = Math.max(0, meaning_pressure - processed_amount);
        npc.E += this.alpha * unprocessed - this.beta_E * npc.E;
        npc.E = Math.max(0, npc.E);
        return npc;
    },
    
    checkLeap(npc: NPCState): [boolean, number, number] {
        const kappa_values = Object.values(npc.kappa);
        const mean_kappa = kappa_values.length > 0 ? kappa_values.reduce((a,b)=>a+b,0) / kappa_values.length : 0.1;
        const fatigue_factor = npc.fatigue / 100.0;
        const Theta = this.Theta0 + this.a1 * mean_kappa - this.a2 * fatigue_factor;
        const h = this.h0 * Math.exp((npc.E - Theta) / this.gamma);
        const jump_prob = 1 - Math.exp(-h * 1.0);
        return [Math.random() < jump_prob, h, Theta];
    },

    updateTemperature(npc: NPCState): NPCState {
        const kappa_values = Object.values(npc.kappa);
        const entropy = kappa_values.length > 1 ? (Math.max(...kappa_values) - Math.min(...kappa_values)) : 0.5;
        npc.T = this.T0 + this.c1 * npc.E - this.c2 * entropy;
        npc.T = Math.max(0.1, Math.min(1.0, npc.T));
        return npc;
    },
    
    getPersonalSleepPressure(npc: NPCState, dayNight: DayNightState): number {
        const timeOfDay = (dayNight.tick % DAY_LENGTH) / DAY_LENGTH;
        const env_pressure = dayNightCycle.getSleepPressure(timeOfDay);
        const debt_pressure = Math.min(1.0, npc.sleep_debt / 100);
        const fatigue_pressure = Math.min(1.0, npc.fatigue / 100);
        return (env_pressure * 0.5 + debt_pressure * 0.3 + fatigue_pressure * 0.2);
    },

    shouldSleep(npc: NPCState, dayNight: DayNightState): boolean {
        if (npc.is_sleeping) return true;
        if (npc.sleep_debt > 150) return true;
        if (npc.fatigue > 90) return true;
        if (dayNight.isNight && npc.fatigue > 60) return true;
        const pressure = this.getPersonalSleepPressure(npc, dayNight);
        if (pressure > 0.7 && npc.hunger < 85) return true;
        return false;
    },
    
    processSleep(npc: NPCState, dayNight: DayNightState, log: LogEntry[], tick: number): {npc: NPCState, log: LogEntry[]} {
        const timeBonus = dayNight.isNight ? 1.5 : 1.0;
        const recovery = 6.0 * timeBonus * (1 + 0.2 * npc.preset.stamina);
        
        npc.fatigue = Math.max(0, npc.fatigue - recovery);
        npc.injury = Math.max(0, npc.injury - 2.0 * timeBonus);
        npc.hunger = Math.min(120, npc.hunger + 0.5);
        npc.E = Math.max(0, npc.E - 0.3 * timeBonus);
        npc.sleep_debt = Math.max(0, npc.sleep_debt - 4.0 * timeBonus);

        let wake_reason: string | null = null;
        if (!dayNight.isNight && npc.fatigue < 30 && npc.sleep_debt < 40) wake_reason = "natural";
        if (npc.hunger > 95) wake_reason = "hunger_emergency";
        
        if (wake_reason) {
            npc.is_sleeping = false;
            log.push({t: tick, name: npc.name, action: 'wake_up', wake_reason, time_of_day: dayNight.phase });
            if (wake_reason === 'natural') {
                npc.T = this.T0;
                npc.boredom = 0.0;
            }
        }
        return {npc, log};
    },
};

const stepNPC = (
    npc: NPCState,
    currentState: SimulationState
): { npc: NPCState, env: Environment, log: LogEntry[] } => {
    let { env, log, tick, dayNight, npcs } = currentState;
    
    // --- SLEEPING ---
    if (npc.is_sleeping) {
        const res = NPC_LOGIC.processSleep(npc, dayNight, [], tick);
        return { npc: res.npc, env, log: res.log };
    }

    // --- METABOLISM ---
    const timeOfDay = (tick % DAY_LENGTH) / DAY_LENGTH;
    const costMult = dayNightCycle.getActivityCostMultiplier(timeOfDay);
    npc.hunger = Math.min(120, npc.hunger + 1.8 * costMult);
    npc.fatigue = Math.min(120, npc.fatigue + 0.8 * costMult);
    npc.sleep_debt = Math.min(200, npc.sleep_debt + 1.5);

    // --- DEATH CHECK ---
    if (npc.hunger >= 100 || npc.injury >= 100) {
        const [leap] = NPC_LOGIC.checkLeap(npc);
        if (leap || npc.hunger >= 110 || npc.injury >= 110) {
            npc.alive = false;
            log.push({ t: tick, name: npc.name, action: 'death', details: npc.hunger >= 100 ? 'starvation' : 'injury', time_of_day: dayNight.phase });
            return { npc, env, log: [] };
        }
    }
    
    // --- SLEEP DECISION ---
    if (NPC_LOGIC.shouldSleep(npc, dayNight)) {
        npc.is_sleeping = true;
        log.push({t: tick, name: npc.name, action: 'sleep_start', time_of_day: dayNight.phase, sleep_debt: npc.sleep_debt});
        return {npc, env, log: []};
    }

    npc = NPC_LOGIC.updateTemperature(npc);
    
    // --- NIGHT AVOIDANCE ---
    if (dayNight.isNight && npc.preset.avoidance > 0.5 && Math.random() < 0.7) {
        log.push({ t: tick, name: npc.name, action: 'night_rest', time_of_day: dayNight.phase });
        return { npc, env, log: [] };
    }
    
    // --- FORAGE ---
    if (npc.hunger > NPC_LOGIC.TH_H) {
        // Simple search for food
        let best_cell: {x:number, y:number, food:number} | null = null;
        for(let dx=-2; dx<=2; dx++) {
            for(let dy=-2; dy<=2; dy++) {
                const nx = npc.x + dx;
                const ny = npc.y + dy;
                if(nx >=0 && nx < ENV_SIZE && ny >=0 && ny < ENV_SIZE) {
                    if(!best_cell || env[ny][nx].food > best_cell.food) {
                        best_cell = {x:nx, y:ny, food: env[ny][nx].food};
                    }
                }
            }
        }

        if (best_cell && best_cell.food > 5) {
            npc.x = best_cell.x;
            npc.y = best_cell.y;

            const forageMod = dayNightCycle.getForageSuccessModifier(timeOfDay);
            if (Math.random() < forageMod) {
                 const eaten = Math.min(env[npc.y][npc.x].food, 25);
                 npc.hunger -= eaten;
                 env[npc.y][npc.x].food -= eaten;
                 npc = NPC_LOGIC.updateKappa(npc, 'forage', true, eaten);
                 log.push({t:tick, name:npc.name, action: 'eat_success', amount: eaten, time_of_day: dayNight.phase});
            } else {
                 npc = NPC_LOGIC.updateKappa(npc, 'forage', false, 0);
                 log.push({t:tick, name:npc.name, action: 'eat_fail', time_of_day: dayNight.phase});
            }
        } else {
            // Patrol if no food nearby
             const moveX = Math.floor(Math.random() * 3) - 1;
             const moveY = Math.floor(Math.random() * 3) - 1;
             npc.x = Math.max(0, Math.min(ENV_SIZE - 1, npc.x + moveX));
             npc.y = Math.max(0, Math.min(ENV_SIZE - 1, npc.y + moveY));
        }
    // --- PATROL ---
    } else {
        const moveRange = Math.round(npc.T * 2);
        const moveX = Math.floor(Math.random() * (2*moveRange+1)) - moveRange;
        const moveY = Math.floor(Math.random() * (2*moveRange+1)) - moveRange;
        npc.x = Math.max(0, Math.min(ENV_SIZE - 1, npc.x + moveX));
        npc.y = Math.max(0, Math.min(ENV_SIZE - 1, npc.y + moveY));
        npc.boredom += 0.05;
        npc = NPC_LOGIC.updateHeat(npc, npc.boredom * 0.1, 0);
        log.push({t:tick, name:npc.name, action: 'patrol', time_of_day: dayNight.phase});
    }

    return { npc, env, log: [] };
};


// Main update function
export const updateSimulation = (currentState: SimulationState): SimulationState => {
    const { tick } = currentState;
    const newTick = tick + 1;
    const newLog: LogEntry[] = [];
    
    let newEnv = updateEnvironment(currentState.env);

    const updatedNpcs = currentState.npcs.map(npc => {
        if (!npc.alive) return npc;
        const result = stepNPC(npc, { ...currentState, env: newEnv });
        newEnv = result.env;
        newLog.push(...result.log);
        return result.npc;
    });

    return {
        ...currentState,
        npcs: updatedNpcs,
        env: newEnv,
        log: [...currentState.log, ...newLog.map(l => ({ ...l, t: newTick }))],
        tick: newTick,
        dayNight: dayNightCycle.getState(newTick),
    };
};