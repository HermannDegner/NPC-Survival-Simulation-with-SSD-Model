import { NPC_PRESETS, ENV_SIZE } from '../constants';
import type { NPCState, LogEntry, NPCPreset, Berry, HuntZone } from '../types';

// Helper function for random numbers
const randRange = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(randRange(min, max));

// --- ENVIRONMENT CLASS ---
class EnvScarce {
    public berries: Record<string, Berry> = {};
    public huntzones: Record<string, HuntZone> = {};
    public t = 0;

    constructor() {
        this.reset();
    }

    reset() {
        this.berries = {};
        for (let i = 0; i < 6; i++) { // Increased berry count
            const x = randInt(0, ENV_SIZE);
            const y = randInt(0, ENV_SIZE);
            this.berries[`${x},${y}`] = {
                "abundance": randRange(0.6, 0.9), // Increased abundance
                "regen": randRange(0.01, 0.02)      // Increased regen
            };
        }
        this.huntzones = {};
        for (let i = 0; i < 5; i++) {
            const x = randInt(0, ENV_SIZE);
            const y = randInt(0, ENV_SIZE);
            this.huntzones[`${x},${y}`] = {
                "base_success": randRange(0.25, 0.5),
                "danger": randRange(0.2, 0.55),
                "population": randRange(0.7, 1.0),
                "regen": randRange(0.005, 0.015),
                "unsafe_until": 0
            };
        }
        this.t = 0;
    }

    step() {
        for (const k in this.berries) {
            const v = this.berries[k];
            v.abundance = Math.min(1.0, v.abundance + v.regen * (1.0 - v.abundance));
        }
        for (const k in this.huntzones) {
            const v = this.huntzones[k];
            v.base_success = Math.max(0.03, Math.min(0.8, v.base_success + (Math.random() - 0.5) * 0.02));
            v.population = Math.min(1.0, v.population + v.regen * (1.0 - v.population));
        }
        this.t += 1;
    }

    posFromString(s: string): [number, number] {
        return s.split(',').map(Number) as [number, number];
    }
    
    manhattanDist(p1: [number, number], p2: [number, number]): number {
        return Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]);
    }

    nearest_nodes(pos: [number, number], node_dict: Record<string, any>, k = 4) {
        return Object.keys(node_dict)
            .sort((a, b) => this.manhattanDist(this.posFromString(a), pos) - this.manhattanDist(this.posFromString(b), pos))
            .slice(0, k);
    }
    
    forage(pos: [number, number], node_pos: [number, number]): [boolean, number, number, number] {
        const nodeKey = `${node_pos[0]},${node_pos[1]}`;
        const abundance = this.berries[nodeKey].abundance;
        const dist = this.manhattanDist(pos, node_pos);
        const p = 0.6 * abundance + 0.2 * Math.max(0, 1 - dist / 12);
        const success = Math.random() < p;
        let food = 0.0;
        if (success) {
            this.berries[nodeKey].abundance = Math.max(0.0, this.berries[nodeKey].abundance - randRange(0.2, 0.4));
            food = randRange(10, 20) * (0.5 + abundance / 2);
        }
        const risk = 0.05;
        return [success, food, risk, p];
    }
    
    hunt(pos: [number, number], node_pos: [number, number], injury_factor = 1.0, coop_bonus = 0.0): [boolean, number, number, number] {
        const nodeKey = `${node_pos[0]},${node_pos[1]}`;
        const zone = this.huntzones[nodeKey];
        const base = zone.base_success * zone.population; // Success depends on population
        const dist = this.manhattanDist(pos, node_pos);
        let p = base * Math.max(0.15, 1 - dist / 14);
        p *= injury_factor;
        p *= (1 + coop_bonus);
        p = Math.max(0.01, Math.min(0.95, p));
        const success = Math.random() < p;
        let food = 0.0;
        if (success) {
            food = randRange(20, 45) * (0.5 + base / 2) * (1 + 0.25 * coop_bonus);
            zone.population = Math.max(0, zone.population - randRange(0.1, 0.25));
        }
        const risk = zone.danger * (0.9 + dist / 18);
        return [success, food, risk, p];
    }

    markHuntZoneUnsafe(node_pos: [number, number], duration: number) {
        const nodeKey = `${node_pos[0]},${node_pos[1]}`;
        if(this.huntzones[nodeKey]) {
            this.huntzones[nodeKey].unsafe_until = this.t + duration;
        }
    }
}


// --- NPC CLASS with SSD Model ---
class NPCWithSSD implements NPCState {
    // Basic state
    name: string;
    x: number;
    y: number;
    hunger = 50.0;
    fatigue = 30.0;
    injury = 0.0;
    alive = true;
    state = "Idle";
    log: LogEntry[] = [];
    preset: NPCPreset;

    // SSD parameters
    kappa: { [key: string]: number } = { forage: 0.1, hunt: 0.1, rest: 0.1, help: 0.1 };
    E = 0.0; // Heat
    T = 0.3; // Temperature

    // Relationships
    rel: { [key: string]: number } = {};
    help_debt: { [key: string]: number } = {};
    
    // Internal tracking
    boredom = 0.0;
    failed_forage_strikes: { [key: string]: number } = {};

    private env: EnvScarce;
    private roster_ref: { [key: string]: NPCWithSSD };

    // ... (SSD constants)
    private readonly kappa_min = 0.05;
    private readonly G0 = 0.5;
    private readonly g = 0.7;
    private readonly eta = 0.3;
    private readonly lambda_forget = 0.02;
    private readonly rho = 0.1;
    private readonly alpha = 0.6;
    private readonly beta_E = 0.15;
    private readonly Theta0 = 1.0;
    private readonly a1 = 0.5;
    private readonly a2 = 0.4;
    private readonly h0 = 0.2;
    private readonly gamma = 0.8;
    private readonly T0 = 0.3;
    private readonly c1 = 0.5;
    private readonly c2 = 0.6;
    private readonly TH_H = 55.0;
    private readonly TH_F = 70.0;


    constructor(name: string, preset: NPCPreset, env: EnvScarce, roster_ref: { [key: string]: NPCWithSSD }, start_pos: [number, number]) {
        this.name = name;
        this.preset = preset;
        this.env = env;
        this.roster_ref = roster_ref;
        [this.x, this.y] = start_pos;
    }
    
    // --- Core SSD & State Update Methods ---
    private alignment_flow = (action_type: string, meaning_pressure: number) => (this.G0 + this.g * this.kappa[action_type]) * meaning_pressure;
    private update_kappa = (action_type: string, success: boolean, reward: number) => {
        const kappa = this.kappa[action_type];
        const work = success ? this.eta * reward : -this.rho * (kappa ** 2);
        const decay = this.lambda_forget * (kappa - this.kappa_min);
        this.kappa[action_type] = Math.max(this.kappa_min, kappa + work - decay);
    };
    private update_heat = (meaning_pressure: number, processed_amount: number) => {
        const unprocessed = Math.max(0, meaning_pressure - processed_amount);
        this.E += this.alpha * unprocessed - this.beta_E * this.E;
        this.E = Math.max(0, this.E);
    };
     private check_leap = (): [boolean, number, number] => {
        const mean_kappa = Object.keys(this.kappa).length > 0 ? Object.values(this.kappa).reduce((s, v) => s + v, 0) / Object.keys(this.kappa).length : 0.1;
        const fatigue_factor = this.fatigue / 100.0;
        const Theta = this.Theta0 + this.a1 * mean_kappa - this.a2 * fatigue_factor;
        const h = this.h0 * Math.exp((this.E - Theta) / this.gamma);
        const jump_prob = 1 - Math.exp(-h * 1.0);
        return [Math.random() < jump_prob, h, Theta];
    };
    private update_temperature = () => {
        const kappa_values = Object.values(this.kappa);
        const entropy = kappa_values.length > 1 ? Math.sqrt(kappa_values.reduce((s, v) => s + (v - (kappa_values.reduce((a, b) => a + b, 0) / kappa_values.length)) ** 2, 0) / (kappa_values.length -1)) : 0.5;
        this.T = this.T0 + this.c1 * this.E - this.c2 * entropy;
        this.T = Math.max(0.1, Math.min(1.0, this.T));
    };

    // --- Social & Movement ---
    pos = (): [number, number] => [this.x, this.y];
    dist_to = (o: NPCWithSSD) => Math.abs(this.x - o.x) + Math.abs(this.y - o.y);
    move_towards = (target: [number, number]) => {
        this.x += Math.sign(target[0] - this.x);
        this.y += Math.sign(target[1] - this.y);
    };
    nearby_allies = (radius = 3) => Object.values(this.roster_ref).filter(o => o.name !== this.name && o.alive && this.dist_to(o) <= radius);

    // --- Decision Logic ---
    private help_utility(o: NPCWithSSD) {
        const need = Math.max(0, (o.hunger - 55) / 40) + Math.max(0, (o.injury - 15) / 50) + Math.max(0, (o.fatigue - 70) / 50);
        const base = 0.35 * this.preset.empathy + 0.4 * (this.rel[o.name] || 0) + 0.35 * (this.help_debt[o.name] || 0);
        const myneed = Math.max(0, (this.hunger - 55) / 40) + Math.max(0, (this.injury - 15) / 50) + Math.max(0, (this.fatigue - 70) / 50);
        return need * base - 0.4 * myneed;
    }

    private maybe_help(t: number): boolean {
         const allies = this.nearby_allies(5);
        if (!allies.length) return false;
        
        const best_target = allies.reduce((best, o) => {
            const u = this.help_utility(o);
            return u > (best ? best.u : 0) ? { o, u } : best;
        }, null as { o: NPCWithSSD, u: number } | null);
        
        if (best_target && best_target.u > 0.15) {
            const target = best_target.o;
            if (this.hunger < 85 && target.hunger > 75) {
                const delta = 25.0;
                this.hunger += 6.0;
                target.hunger = Math.max(0.0, target.hunger - delta);
                this.rel[target.name] = (this.rel[target.name] || 0) + 0.08;
                target.rel[this.name] = (target.rel[this.name] || 0) + 0.04;
                target.help_debt[this.name] = (target.help_debt[this.name] || 0) + 0.2;
                this.update_kappa("help", true, delta * 0.5);
                this.log.push({ t, name: this.name, state: "Help", action: "share_food", target: target.name, amount: delta, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_help: this.kappa.help });
                return true;
            } else if (target.injury > 30 || target.fatigue > 85) {
                target.fatigue = Math.max(0, target.fatigue - 28.0 * (1 + 0.2 * this.preset.stamina));
                target.injury = Math.max(0, target.injury - 7.0);
                this.fatigue += 6.0;
                this.rel[target.name] = (this.rel[target.name] || 0) + 0.1;
                target.rel[this.name] = (target.rel[this.name] || 0) + 0.05;
                target.help_debt[this.name] = (target.help_debt[this.name] || 0) + 0.25;
                this.update_kappa("help", true, 20.0);
                this.log.push({ t, name: this.name, state: "Help", action: "tend_wounds", target: target.name, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_help: this.kappa.help });
                return true;
            }
        }
        return false;
    }
    
    // --- Main Step Function ---
    step(t: number) {
        if (!this.alive) return;

        // Metabolism
        this.hunger = Math.min(120, this.hunger + 1.8);
        this.fatigue = Math.min(120, this.fatigue + 0.8);
        this.injury = Math.min(120, this.injury + 0.02 * this.fatigue / 100);

        // Death check
        if (this.hunger >= 100 || this.injury >= 100) {
            const [leap_occurred, h, Theta] = this.check_leap();
            if (leap_occurred || this.hunger >= 110 || this.injury >= 110) {
                this.alive = false;
                this.log.push({ t, name: this.name, state: "Dead", action: "death", hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, jump_rate: h, Theta: Theta });
                return;
            }
        }
        
        this.update_temperature();
        if (this.maybe_help(t)) return;

        // Rest
        if (this.fatigue > this.TH_F && this.hunger < this.TH_H * 0.9) {
            const rest_amount = 30 * (1 + 0.25 * this.preset.stamina);
            this.fatigue = Math.max(0, this.fatigue - rest_amount);
            this.hunger += 6;
            this.injury = Math.max(0, this.injury - 4 * (1 + 0.1 * this.preset.stamina));
            this.update_kappa("rest", true, rest_amount);
            this.update_heat(0.8, rest_amount / 30);
            this.log.push({ t, name: this.name, state: "Sleep", action: "sleep", amount: rest_amount, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_rest: this.kappa.rest });
            return;
        }

        // Forage/Hunt
        if (this.hunger > this.TH_H) {
            const meaning_p = (this.hunger - this.TH_H) / (100 - this.TH_H);
            
            // Utility calculation for best action
            const forage_utility = (node_key: string) => {
                const node_pos = this.env.posFromString(node_key);
                const dist = this.env.manhattanDist(this.pos(), node_pos);
                if ((this.failed_forage_strikes[node_key] || 0) >= 3) return -99;
                return this.env.berries[node_key].abundance * 40 - dist * 1.5;
            };
            const hunt_utility = (node_key: string) => {
                const node_pos = this.env.posFromString(node_key);
                const dist = this.env.manhattanDist(this.pos(), node_pos);
                const zone = this.env.huntzones[node_key];
                if (zone.unsafe_until > this.env.t) return -99;
                const coop_bonus = this.nearby_allies(3).length * 0.3;
                return (zone.base_success * zone.population * 60) * (1 - zone.danger * 0.7) * (1 + coop_bonus) * this.preset.risk_tolerance - dist * 1.5;
            };

            const best_forage = this.env.nearest_nodes(this.pos(), this.env.berries, 4).reduce((best, key) => {
                const u = forage_utility(key);
                return u > best.u ? { key, u } : best;
            }, { key: null as string | null, u: -Infinity });

            const best_hunt = this.env.nearest_nodes(this.pos(), this.env.huntzones, 3).reduce((best, key) => {
                const u = hunt_utility(key);
                return u > best.u ? { key, u } : best;
            }, { key: null as string | null, u: -Infinity });


            if (best_forage.u > best_hunt.u && best_forage.key) {
                const node_pos = this.env.posFromString(best_forage.key);
                this.move_towards(node_pos);
                const [success, food, risk, p] = this.env.forage(this.pos(), node_pos);
                
                if (success) {
                    this.hunger = Math.max(0, this.hunger - food);
                    this.update_kappa("forage", true, food);
                    this.failed_forage_strikes[best_forage.key] = 0;
                     this.log.push({ t, name: this.name, state: "Food", action: "eat_success", amount: food, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_forage: this.kappa.forage });
                } else {
                    this.update_kappa("forage", false, 0);
                    this.failed_forage_strikes[best_forage.key] = (this.failed_forage_strikes[best_forage.key] || 0) + 1;
                    this.log.push({ t, name: this.name, state: "Food", action: "eat_fail", hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_forage: this.kappa.forage });
                }
                this.update_heat(meaning_p, this.alignment_flow("forage", meaning_p));
            } else if (best_hunt.key) {
                const node_pos = this.env.posFromString(best_hunt.key);
                this.move_towards(node_pos);
                const coop_bonus = this.nearby_allies(3).length * 0.3;
                const injury_factor = 1.0 - (this.injury / 120);
                const [success, food, risk, p] = this.env.hunt(this.pos(), node_pos, injury_factor, coop_bonus);
                if (success) {
                    this.hunger = Math.max(0, this.hunger - food);
                    this.update_kappa("hunt", true, food);
                    this.log.push({ t, name: this.name, state: "Hunt", action: "hunt_success", amount: food, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_hunt: this.kappa.hunt });
                } else {
                    this.update_kappa("hunt", false, 0);
                    if (Math.random() < risk) {
                        const dmg = randRange(5, 25);
                        this.injury = Math.min(100, this.injury + dmg);
                        this.env.markHuntZoneUnsafe(node_pos, randInt(10, 20));
                    }
                    this.log.push({ t, name: this.name, state: "Hunt", action: "hunt_fail", hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_hunt: this.kappa.hunt });
                }
                this.update_heat(meaning_p, this.alignment_flow("hunt", meaning_p));
            } else {
                 this.state = 'Explore';
                 this.move_towards([randInt(0, ENV_SIZE), randInt(0, ENV_SIZE)]);
                 this.update_heat(meaning_p, 0);
                 this.log.push({t, name: this.name, state: "Explore", action: "explore", hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T});
            }
            return;
        }

        // Patrol
        this.state = 'Patrol';
        const move_range = Math.floor(this.T * 3);
        this.x = Math.max(0, Math.min(ENV_SIZE - 1, this.x + randInt(-move_range, move_range + 1)));
        this.y = Math.max(0, Math.min(ENV_SIZE - 1, this.y + randInt(-move_range, move_range + 1)));
        this.boredom += 0.05;
        this.update_heat(this.boredom * 0.1, 0);
        this.log.push({ t, name: this.name, state: "Patrol", action: "patrol", hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, boredom: this.boredom });
    }
}


// --- SIMULATION SERVICE ---
export class SimulationService {
    public env!: EnvScarce;
    public roster!: { [key: string]: NPCWithSSD };
    public npcs!: NPCWithSSD[];
    
    constructor() {
        this.reset();
    }

    reset() {
        this.env = new EnvScarce();
        this.roster = {};
        const center: [number, number] = [Math.floor(ENV_SIZE / 2), Math.floor(ENV_SIZE / 2)];
        const starts: [number, number][] = [
            [center[0] - 2, center[1]],
            [center[0] + 2, center[1] - 1],
            [center[0], center[1] + 2],
            [center[0] - 1, center[1] - 2],
            [center[0] + 1, center[1] + 1]
        ];

        let i = 0;
        for (const name in NPC_PRESETS) {
            this.roster[name] = new NPCWithSSD(name, NPC_PRESETS[name], this.env, this.roster, starts[i % starts.length]);
            i++;
        }
        
        this.npcs = Object.values(this.roster);
        
        return {
            initialNpcs: this.npcs,
            initialEnv: { berries: this.env.berries, huntZones: this.env.huntzones }
        };
    }

    runTick(tick: number): { updatedNpcs: NPCState[], newLogEntries: LogEntry[], updatedEnv: { berries: Record<string, Berry>, huntZones: Record<string, HuntZone> } } {
        const allNewLogs: LogEntry[] = [];
        
        for (const npc of this.npcs) {
            const initialLogLength = npc.log.length;
            npc.step(tick);
            // Capture logs generated only in this step
            if (npc.log.length > initialLogLength) {
                allNewLogs.push(...npc.log.slice(initialLogLength));
            }
        }
        this.env.step();

        return {
            updatedNpcs: this.npcs,
            newLogEntries: allNewLogs,
            updatedEnv: {
                berries: { ...this.env.berries },
                huntZones: { ...this.env.huntzones }
            }
        };
    }
}
