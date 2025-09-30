import React from 'react';
import type { DayNightState } from '../types';
import { useTranslation } from '../contexts/LocalizationContext';

interface ControlPanelProps {
    isRunning: boolean;
    onStartPause: () => void;
    onReset: () => void;
    speed: number;
    onSpeedChange: (speed: number) => void;
    tick: number;
    maxTicks: number;
    dayNight: DayNightState;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ isRunning, onStartPause, onReset, speed, onSpeedChange, tick, maxTicks, dayNight }) => {
    const { t } = useTranslation();

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-3 text-cyan-300">{t('controls.title')}</h2>
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={onStartPause}
                    className={`px-4 py-2 rounded-md font-semibold text-white transition-colors w-24 ${isRunning ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {isRunning ? t('controls.pause') : t('controls.start')}
                </button>
                <button
                    onClick={onReset}
                    className="px-4 py-2 rounded-md font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors w-24"
                >
                    {t('controls.reset')}
                </button>
            </div>
            <div className="mb-4">
                <label htmlFor="speed" className="block text-sm font-medium text-gray-300 mb-1">{t('controls.speed')}</label>
                <input
                    type="range"
                    id="speed"
                    min="1"
                    max="100"
                    value={speed}
                    onChange={(e) => onSpeedChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('controls.progress')}</label>
                <div className="w-full bg-gray-700 rounded-full h-4">
                    <div
                        className="bg-cyan-500 h-4 rounded-full transition-all duration-200"
                        style={{ width: `${(tick / maxTicks) * 100}%` }}
                    ></div>
                </div>
                <p className="text-center text-sm mt-1 text-gray-400">{t('controls.tick', { tick, maxTicks })}</p>
            </div>
            <div className="text-center bg-gray-900/50 p-2 rounded-md">
                <p className="font-semibold text-gray-300">
                    {t('day', { day: dayNight.day })}
                    <span className="text-yellow-300 ml-2">{t(`phases.${dayNight.phase}`)}</span>
                </p>
            </div>
        </div>
    );
};

export default ControlPanel;