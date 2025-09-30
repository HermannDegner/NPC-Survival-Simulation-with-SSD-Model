import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions,
    Filler,
} from 'chart.js';
import type { ChartData } from '../types';
import { useTranslation } from '../contexts/LocalizationContext';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface ChartsProps {
    populationData: ChartData;
    sleepDebtData: ChartData;
}

type ChartType = 'population' | 'sleepDebt';

const Charts: React.FC<ChartsProps> = ({ populationData, sleepDebtData }) => {
    const { t } = useTranslation();
    const [activeChart, setActiveChart] = useState<ChartType>('population');

    const chartConfig: Record<ChartType, { data: ChartData, options: ChartOptions<'line'> }> = {
        population: {
            data: populationData,
            options: {
                plugins: {
                    title: { text: t('charts.population.title') },
                },
                scales: {
                     y: { min: 0, ticks: { stepSize: 1 } }
                }
            }
        },
        sleepDebt: {
            data: sleepDebtData,
            options: {
                 plugins: {
                    title: { text: t('charts.sleepDebt.title') }
                },
                 scales: {
                     y: { min: 0 }
                }
            }
        }
    };
    
    const baseOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { color: '#e5e7eb' }
            },
            title: {
                display: true,
                color: '#67e8f9',
                font: { size: 16 }
            },
        },
        scales: {
            x: {
                ticks: { color: '#9ca3af' },
                grid: { color: 'rgba(156, 163, 175, 0.1)' }
            },
            y: {
                ticks: { color: '#9ca3af' },
                grid: { color: 'rgba(156, 163, 175, 0.2)' },
            }
        },
        elements: {
            point: { radius: 0 },
            line: { tension: 0.3 }
        }
    };

    const currentChart = chartConfig[activeChart];
    
    // Deep merge options
    const finalOptions = {
        ...baseOptions,
        ...currentChart.options,
        plugins: { ...baseOptions.plugins, ...currentChart.options.plugins },
        scales: { ...baseOptions.scales, y: {...baseOptions.scales?.y, ...currentChart.options.scales?.y} }
    };


    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col h-72">
            <div className="flex justify-center gap-2 mb-2">
                <button 
                    onClick={() => setActiveChart('population')}
                    className={`px-3 py-1 text-xs rounded-md ${activeChart === 'population' ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                >{t('charts.population.button')}</button>
                <button 
                    onClick={() => setActiveChart('sleepDebt')}
                    className={`px-3 py-1 text-xs rounded-md ${activeChart === 'sleepDebt' ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                >{t('charts.sleepDebt.button')}</button>
            </div>
            <div className="flex-grow relative">
                <Line options={finalOptions} data={currentChart.data} />
            </div>
        </div>
    );
};

export default Charts;