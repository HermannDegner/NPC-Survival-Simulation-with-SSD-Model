
import type { NPCPreset } from './types';

export const TICKS = 200;
export const ENV_SIZE = 26;

export const NPC_PRESETS: { [key: string]: NPCPreset } = {
    "Forager_A": { risk_tolerance: 0.2, curiosity: 0.3, avoidance: 0.8, stamina: 0.6, empathy: 0.8, color: "text-green-400" },
    "Tracker_B": { risk_tolerance: 0.6, curiosity: 0.5, avoidance: 0.2, stamina: 0.8, empathy: 0.6, color: "text-blue-400" },
    "Pioneer_C": { risk_tolerance: 0.5, curiosity: 0.9, avoidance: 0.3, stamina: 0.7, empathy: 0.5, color: "text-yellow-400" },
    "Guardian_D": { risk_tolerance: 0.4, curiosity: 0.4, avoidance: 0.6, stamina: 0.9, empathy: 0.9, color: "text-purple-400" },
    "Scavenger_E": { risk_tolerance: 0.3, curiosity: 0.6, avoidance: 0.7, stamina: 0.5, empathy: 0.5, color: "text-orange-400" }
};
