import { ENV_SIZE, NPC_PRESETS } from '../constants';
import type { LogEntry, NPCState, NPCPreset } from '../types';

// Helper for random numbers
const randRange = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (max: number) => Math.floor(Math.random() * max);

// Helper to clip a number between a min and max
const clip = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

// Simple normal distribution approximation (Box-Muller is overkill for this viz)
const randNormal = (mean = 0, stdev = 1) => {
    let u = 1 - Math.random(); 
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
}

class DefaultDict<T> extends Map<string, T> {
    constructor(private defaultValue: () => T) {
        super();
    }
    get(key: string): T {
        if (!this.has(key)) {
            this.set(key, this.defaultValue());
        }
        return super.get(key)!;
    }
}

// -------- Environment --------
export class EnvScarce {
    size: number;
    berries: Record<string, { abundance: number; regen: number }> = {};
    huntzones: Record<string, { base_success: number; danger: number; last_injury_tick?: number }> = {};
    t: number = 0;

    constructor(size = ENV_SIZE, n_berry = 4, n_hunt = 5) {
        this.size = size;
        for (let i = 0; i < n_berry; i++) {
            const x = randInt(size);
            const y = randInt(size);
            this.berries[`${x},${y}`] = { abundance: randRange(0.1, 0.3), regen: randRange(0.001, 0.008) };
        }
        for (let i = 0; i < n_hunt; i++) {
            const x = randInt(size);
            const y = randInt(size);
            this.huntzones[`${x},${y}`] = { base_success: randRange(0.10, 0.30), danger: randRange(0.35, 0.75) };
        }
    }

    step() {
        for (const v of Object.values(this.berries)) {
            v.abundance = Math.min(1.0, v.abundance + v.regen * (1.0 - v.abundance));
        }
        for (const v of Object.values(this.huntzones)) {
            v.base_success = clip(v.base_success + randNormal(0, 0.01), 0.03, 0.8);
        }
        this.t++;
    }
    
    markHuntZoneUnsafe(nodeKey: string, tick: number) {
        if (this.huntzones[nodeKey]) {
            this.huntzones[nodeKey].last_injury_tick = tick;
        }
    }

    nearest_nodes(pos: { x: number; y: number }, node_dict: Record<string, any>, k = 4) {
        const nodes = Object.keys(node_dict);
        nodes.sort((a, b) => {
            const [ax, ay] = a.split(',').map(Number);
            const [bx, by] = b.split(',').map(Number);
            const distA = Math.abs(ax - pos.x) + Math.abs(ay - pos.y);
            const distB = Math.abs(bx - pos.x) + Math.abs(by - pos.y);
            return distA - distB;
        });
        return nodes.slice(0, k);
    }

    forage(pos: { x: number; y: number }, nodeKey: string): [boolean, number, number, number] {
        const node = this.berries[nodeKey];
        if (!node) return [false, 0, 0, 0];
        const [nx, ny] = nodeKey.split(',').map(Number);

        const abundance = node.abundance;
        const dist = Math.abs(pos.x - nx) + Math.abs(pos.y - ny);
        const p = 0.6 * abundance + 0.2 * Math.max(0, 1 - dist / 12);
        const success = Math.random() < p;
        
        let food = 0;
        if (success) {
            node.abundance = Math.max(0.0, node.abundance - randRange(0.2, 0.4));
            food = randRange(10, 20) * (0.5 + abundance / 2);
        }
        const risk = 0.05;
        return [success, food, risk, p];
    }

    hunt(pos: { x: number; y: number }, nodeKey: string, injury_factor = 1.0, coop_bonus = 0.0): [boolean, number, number, number] {
        const zone = this.huntzones[nodeKey];
        if (!zone) return [false, 0, 0, 0];
        const [nx, ny] = nodeKey.split(',').map(Number);

        const base = zone.base_success;
        const dist = Math.abs(pos.x - nx) + Math.abs(pos.y - ny);
        let p = base * Math.max(0.15, 1 - dist / 14);
        p *= injury_factor;
        p *= (1 + coop_bonus);
        p = clip(p, 0.01, 0.95);

        const success = Math.random() < p;
        let food = 0;
        if (success) {
            food = randRange(20, 45) * (0.5 + base / 2) * (1 + 0.25 * coop_bonus);
        }
        const risk = zone.danger * (0.9 + dist / 18);
        return [success, food, risk, p];
    }
}


// -------- NPC with SSD Mathematical Model --------
export class NPCWithSSD {
    name: string;
    preset: NPCPreset;
    env: EnvScarce;
    roster_ref: Record<string, NPCWithSSD>;
    x: number;
    y: number;
    
    hunger = 50.0;
    fatigue = 30.0;
    injury = 0.0;
    alive = true;
    state = "Idle";
    
    kappa = new DefaultDict<number>(() => 0.1);
    kappa_min = 0.05;
    E = 0.0;
    T = 0.3;
    
    G0 = 0.5; g = 0.7; eta = 0.3; lambda_forget = 0.02; rho = 0.1;
    alpha = 0.6; beta_E = 0.15;
    
    Theta0 = 1.0; a1 = 0.5; a2 = 0.4; h0 = 0.2; gamma = 0.8;
    
    T0 = 0.3; c1 = 0.5; c2 = 0.6;
    
    risk_tolerance: number; curiosity: number; avoidance: number;
    stamina: number; empathy: number;
    
    TH_H = 55.0; TH_F = 70.0;
    
    rel = new DefaultDict<number>(() => 0);
    help_debt = new DefaultDict<number>(() => 0);
    forageFailures = new DefaultDict<number>(() => 0);
    
    log: LogEntry[] = [];
    boredom = 0.0;
    
    constructor(name: string, preset: NPCPreset, env: EnvScarce, roster_ref: Record<string, NPCWithSSD>, start_pos: { x: number; y: number }) {
        this.name = name;
        this.preset = preset;
        this.env = env;
        this.roster_ref = roster_ref;
        this.x = start_pos.x;
        this.y = start_pos.y;
        
        this.risk_tolerance = preset.risk_tolerance;
        this.curiosity = preset.curiosity;
        this.avoidance = preset.avoidance;
        this.stamina = preset.stamina;
        this.empathy = preset.empathy;
    }

    pos() { return { x: this.x, y: this.y }; }
    
    dist_to(o: NPCWithSSD) { return Math.abs(this.x - o.x) + Math.abs(this.y - o.y); }
    
    move_towards(target: { x: number; y: number }) {
        this.x += (target.x > this.x ? 1 : target.x < this.x ? -1 : 0);
        this.y += (target.y > this.y ? 1 : target.y < this.y ? -1 : 0);
    }
    
    nearby_allies(radius = 3) {
        return Object.values(this.roster_ref)
            .filter(o => o.name !== this.name && o.alive && this.dist_to(o) <= radius);
    }
    
    alignment_flow(action_type: string, meaning_pressure: number) {
        const kappa = this.kappa.get(action_type);
        return (this.G0 + this.g * kappa) * meaning_pressure;
    }
    
    update_kappa(action_type: string, success: boolean, reward: number) {
        const kappa = this.kappa.get(action_type);
        const work = success ? this.eta * reward : -this.rho * (kappa ** 2);
        const decay = this.lambda_forget * (kappa - this.kappa_min);
        this.kappa.set(action_type, Math.max(this.kappa_min, kappa + work - decay));
    }

    update_heat(meaning_pressure: number, processed_amount: number) {
        const unprocessed = Math.max(0, meaning_pressure - processed_amount);
        this.E += this.alpha * unprocessed - this.beta_E * this.E;
        this.E = Math.max(0, this.E);
    }

    check_leap(): [boolean, number, number] {
        const kappa_values = Array.from(this.kappa.values());
        const mean_kappa = kappa_values.length ? kappa_values.reduce((a, b) => a + b) / kappa_values.length : 0.1;
        const fatigue_factor = this.fatigue / 100.0;
        const Theta = this.Theta0 + this.a1 * mean_kappa - this.a2 * fatigue_factor;
        
        const h = this.h0 * Math.exp((this.E - Theta) / this.gamma);
        const jump_prob = 1 - Math.exp(-h * 1.0);
        
        return [Math.random() < jump_prob, h, Theta];
    }
    
    update_temperature() {
        const kappa_values = Array.from(this.kappa.values());
        let entropy = 0.5;
        if (kappa_values.length > 1) {
            const mean = kappa_values.reduce((a, b) => a + b) / kappa_values.length;
            const std = Math.sqrt(kappa_values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / kappa_values.length);
            entropy = std;
        }
        
        this.T = this.T0 + this.c1 * this.E - this.c2 * entropy;
        this.T = clip(this.T, 0.1, 1.0);
    }

    help_utility(o: NPCWithSSD): number {
        const need = Math.max(0, (o.hunger - 55) / 40) + Math.max(0, (o.injury - 15) / 50) + Math.max(0, (o.fatigue - 70) / 50);
        const base = 0.35 * this.empathy + 0.4 * this.rel.get(o.name) + 0.35 * this.help_debt.get(o.name);
        const myneed = Math.max(0, (this.hunger - 55) / 40) + Math.max(0, (this.injury - 15) / 50) + Math.max(0, (this.fatigue - 70) / 50);
        return need * base - 0.4 * myneed;
    }

    maybe_help(t: number): boolean {
        const allies = this.nearby_allies(3);
        if (allies.length === 0) {
            return false;
        }

        let best: NPCWithSSD | null = null;
        let bestu = 0.0;
        for (const o of allies) {
            const u = this.help_utility(o);
            if (u > bestu) {
                bestu = u;
                best = o;
            }
        }

        if (best && bestu > 0.05) {
            if (this.hunger < 85 && best.hunger > 75) {
                const delta = 25.0;
                this.hunger = Math.min(100.0, this.hunger + 6.0);
                best.hunger = Math.max(0.0, best.hunger - delta);
                this.rel.set(best.name, this.rel.get(best.name) + 0.08);
                best.rel.set(this.name, best.rel.get(this.name) + 0.04);
                best.help_debt.set(this.name, best.help_debt.get(this.name) + 0.2);

                this.update_kappa("help", true, delta * 0.5);
                this.state = "Help";
                this.log.push({ t, name: this.name, state: "Help", action: "share_food", target: best.name, amount: delta, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_help: this.kappa.get("help") });
                return true;

            } else if (best.injury > 30 || best.fatigue > 85) {
                best.fatigue = Math.max(0, best.fatigue - 28.0 * (1 + 0.2 * this.stamina));
                best.injury = Math.max(0, best.injury - 7.0);
                this.fatigue = Math.min(100, this.fatigue + 6.0);
                this.rel.set(best.name, this.rel.get(best.name) + 0.1);
                best.rel.set(this.name, best.rel.get(this.name) + 0.05);
                best.help_debt.set(this.name, best.help_debt.get(this.name) + 0.25);

                this.update_kappa("help", true, 20.0);
                this.state = "Help";
                this.log.push({ t, name: this.name, state: "Help", action: "tend_wounds", target: best.name, amount: 0, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_help: this.kappa.get("help") });
                return true;
            }
        }
        return false;
    }

    step(t: number) {
        if (!this.alive) return;
        
        const hunger_pressure = 1.8;
        const fatigue_pressure = 0.8;
        this.hunger = Math.min(120, this.hunger + hunger_pressure);
        this.fatigue = Math.min(120, this.fatigue + fatigue_pressure);
        this.injury = Math.min(120, this.injury + 0.02 * this.fatigue / 100);

        if (this.hunger >= 100 || this.injury >= 100) {
            const [leap_occurred, h, Theta] = this.check_leap();
            if (leap_occurred || this.hunger >= 110 || this.injury >= 110) {
                this.alive = false;
                this.state = "Dead";
                this.log.push({ t, name: this.name, state: "Dead", action: "death", hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, jump_rate: h, Theta });
                return;
            }
        }
        
        this.update_temperature();

        if (this.maybe_help(t)) {
            return;
        }

        if (this.fatigue > this.TH_F && this.hunger < this.TH_H * 0.9) {
            const rest_amount = 30 * (1 + 0.25 * this.stamina);
            this.fatigue = Math.max(0, this.fatigue - rest_amount);
            this.hunger = Math.min(100, this.hunger + 6);
            this.injury = Math.max(0, this.injury - 4 * (1 + 0.1 * this.stamina));
            
            this.update_kappa("rest", true, rest_amount);
            this.update_heat(fatigue_pressure, rest_amount / 30);
            this.state = "Sleep";
            this.log.push({ t, name: this.name, state: "Sleep", action: "sleep", amount: rest_amount, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_rest: this.kappa.get("rest") });
        }
        else if (this.hunger > this.TH_H) {
            const meaning_p = (this.hunger - this.TH_H) / (100 - this.TH_H);

            const nearby_allies = this.nearby_allies(4);
            const coop_bonus = nearby_allies.length * 0.15;
            const hunt_zones = this.env.nearest_nodes(this.pos(), this.env.huntzones, 1);
            
            let hunt_utility = -1;
            if(hunt_zones.length > 0) {
                const zone_info = this.env.huntzones[hunt_zones[0]];
                hunt_utility = (zone_info.base_success + coop_bonus - (zone_info.danger * (1 - this.risk_tolerance))) * 30;
            }
            
            const berry_nodes = this.env.nearest_nodes(this.pos(), this.env.berries, 1);
            let forage_utility = -1;
            if(berry_nodes.length > 0) {
                const berry_info = this.env.berries[berry_nodes[0]];
                if(berry_info) forage_utility = berry_info.abundance * 0.7 * 15;
            }
            
            const should_hunt = hunt_utility > forage_utility && (this.risk_tolerance > 0.4 || coop_bonus > 0);

            if (should_hunt && hunt_zones.length > 0) {
                const targetNodeKey = hunt_zones[0];
                const [nodeX, nodeY] = targetNodeKey.split(',').map(Number);
                this.move_towards({ x: nodeX, y: nodeY });

                const injury_factor = 1.0 - (this.injury / 150);
                const [success, food, risk, p] = this.env.hunt(this.pos(), targetNodeKey, injury_factor, coop_bonus);
                const j_hunt = this.alignment_flow("hunt", meaning_p);

                if (success) {
                    this.hunger = Math.max(0, this.hunger - food);
                    this.fatigue = Math.min(100, this.fatigue + food * 0.2);
                    if (Math.random() < risk) {
                        this.injury = Math.min(100, this.injury + randRange(5, 20));
                    }
                    this.update_kappa("hunt", true, food);
                    this.update_heat(meaning_p, j_hunt);
                    this.state = "Hunt";
                    this.log.push({ t, name: this.name, state: "Hunt", action: "hunt_success", target: "Animal", amount: food, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_hunt: this.kappa.get("hunt") });
                } else {
                    this.fatigue = Math.min(100, this.fatigue + 10);
                    if (Math.random() < risk * 1.2) {
                        this.injury = Math.min(100, this.injury + randRange(10, 30));
                        this.env.markHuntZoneUnsafe(targetNodeKey, t);
                    }
                    this.update_kappa("hunt", false, 0);
                    this.update_heat(meaning_p, 0);
                    this.state = "Hunt";
                    this.log.push({ t, name: this.name, state: "Hunt", action: "hunt_fail", target: "Animal", amount: 0, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_hunt: this.kappa.get("hunt") });
                }

            } else {
                const j_forage = this.alignment_flow("forage", meaning_p);
                const all_nodes = this.env.nearest_nodes(this.pos(), this.env.berries, 4);
                const nodes = all_nodes.filter(nodeKey => this.forageFailures.get(nodeKey) < 3);

                if (nodes.length > 0) {
                    const targetNodeKey = nodes[0];
                    const [nodeX, nodeY] = targetNodeKey.split(',').map(Number);
                    this.move_towards({ x: nodeX, y: nodeY });
                    const [success, food, risk, p] = this.env.forage(this.pos(), targetNodeKey);
                    
                    if (success) {
                        this.hunger = Math.max(0, this.hunger - food);
                        this.fatigue = Math.max(0, this.fatigue - food * 0.1);
                        this.update_kappa("forage", true, food);
                        this.update_heat(meaning_p, j_forage);
                        this.state = "Food";
                        this.log.push({ t, name: this.name, state: "Food", action: "eat_success", target: "Berry", amount: food, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_forage: this.kappa.get("forage") });
                        this.forageFailures.set(targetNodeKey, 0);
                    } else {
                        this.update_kappa("forage", false, 0);
                        this.update_heat(meaning_p, 0);
                        this.state = "Food";
                        this.log.push({ t, name: this.name, state: "Food", action: "eat_fail", target: "Berry", amount: 0, hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, kappa_forage: this.kappa.get("forage") });
                        
                        const dist = Math.abs(this.x - nodeX) + Math.abs(this.y - nodeY);
                        if (dist <= 1) {
                             this.forageFailures.set(targetNodeKey, this.forageFailures.get(targetNodeKey) + 1);
                        }
                    }
                } else {
                    this.update_heat(meaning_p, 0);
                    this.state = "Searching";
                    this.log.push({ t, name: this.name, state: "Searching", action: "search_food_fallback", hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T });
                    
                    if (Math.random() < 0.1) {
                        this.forageFailures.clear();
                    }

                    const move_range = Math.floor(this.T * 3);
                    const dx = randInt(2 * move_range + 1) - move_range;
                    const dy = randInt(2 * move_range + 1) - move_range;
                    
                    this.x = clip(this.x + dx, 0, this.env.size - 1);
                    this.y = clip(this.y + dy, 0, this.env.size - 1);
                }
            }
        }
        else {
            const move_range = Math.floor(this.T * 2);
            const dx = randInt(2 * move_range + 1) - move_range;
            const dy = randInt(2 * move_range + 1) - move_range;
            
            this.x = clip(this.x + dx, 0, this.env.size - 1);
            this.y = clip(this.y + dy, 0, this.env.size - 1);
            
            this.boredom += 0.05;
            this.update_heat(this.boredom * 0.1, 0);
            this.state = "Patrol";
            this.log.push({ t, name: this.name, state: "Patrol", action: "patrol", hunger: this.hunger, fatigue: this.fatigue, injury: this.injury, E: this.E, T: this.T, boredom: this.boredom });
        }
    }

    getFullState(): NPCState {
        return {
            name: this.name,
            x: this.x,
            y: this.y,
            hunger: this.hunger,
            fatigue: this.fatigue,
            injury: this.injury,
            alive: this.alive,
            state: this.state,
            E: this.E,
            T: this.T,
            preset: this.preset,
            kappa: Object.fromEntries(this.kappa.entries()),
        };
    }
    
    flushLog(): LogEntry[] {
        const entries = [...this.log];
        this.log = [];
        return entries;
    }
}

export const initializeEnv = () => new EnvScarce();

export const initialRoster = (env: EnvScarce) => {
    const roster: Record<string, NPCWithSSD> = {};
    const center = { x: Math.floor(env.size / 2), y: Math.floor(env.size / 2) };
    const starts = [
        { x: center.x - 2, y: center.y },
        { x: center.x + 2, y: center.y - 1 },
        { x: center.x, y: center.y + 2 },
        { x: center.x - 1, y: center.y - 2 },
        { x: center.x + 1, y: center.y + 1 },
    ];
    
    Object.keys(NPC_PRESETS).forEach((name, i) => {
        roster[name] = new NPCWithSSD(name, NPC_PRESETS[name], env, roster, starts[i]);
    });
    
    return roster;
};