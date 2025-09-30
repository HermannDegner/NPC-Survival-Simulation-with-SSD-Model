import React, { useMemo } from 'react';
import type { LogEntry } from '../types';

interface EventLogProps {
    logData: LogEntry[];
}

const EventLog: React.FC<EventLogProps> = ({ logData }) => {
    const significantEvents = useMemo(() => {
        return logData
            .filter(log => !['patrol', 'sleep'].includes(log.action))
            .slice(-100) 
            .reverse();
    }, [logData]);

    const getEventMessage = (log: LogEntry) => {
        switch (log.action) {
            case 'death':
                return <><span className="font-bold text-red-400">{log.name}</span> has died.</>;
            case 'eat_success':
                return <><span className="font-bold text-green-400">{log.name}</span> foraged for {log.amount?.toFixed(0)} food.</>;
            case 'eat_fail':
                return <><span className="font-bold text-yellow-400">{log.name}</span> failed to forage for food.</>;
            case 'hunt_success':
                return <><span className="font-bold text-teal-400">{log.name}</span> successfully hunted, gaining {log.amount?.toFixed(0)} food.</>;
            case 'hunt_fail':
                 return <><span className="font-bold text-orange-400">{log.name}</span> failed to hunt and was possibly injured.</>;
            case 'share_food':
                return <><span className="font-bold text-lime-400">{log.name}</span> shared food with <span className="font-bold text-gray-300">{log.target}</span>.</>;
            case 'tend_wounds':
                 return <><span className="font-bold text-sky-400">{log.name}</span> helped <span className="font-bold text-gray-300">{log.target}</span> recover.</>;
            default:
                return `${log.name} ${log.action}`;
        }
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-3 text-cyan-300">Event Log</h2>
            <div className="h-48 overflow-y-auto bg-gray-900/50 rounded-md p-2 space-y-1 text-sm pr-2">
                {significantEvents.length === 0 && <p className="text-gray-500">No significant events yet...</p>}
                {significantEvents.map((log, index) => (
                    <div key={index} className="flex items-start">
                        <span className="text-gray-500 w-12 text-right mr-2 font-mono flex-shrink-0">T:{log.t}</span>
                        <p className="text-gray-300">{getEventMessage(log)}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventLog;