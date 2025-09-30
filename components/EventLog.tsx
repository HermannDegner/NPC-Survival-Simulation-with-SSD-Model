import React, { useMemo } from 'react';
import type { LogEntry } from '../types';
import { useTranslation } from '../contexts/LocalizationContext';

interface EventLogProps {
    logData: LogEntry[];
}

const EventLog: React.FC<EventLogProps> = ({ logData }) => {
    const { t } = useTranslation();

    const significantEvents = useMemo(() => {
        return logData
            .filter(log => !['patrol', 'night_rest'].includes(log.action))
            .slice(-100) 
            .reverse();
    }, [logData]);

    const getEventMessage = (log: LogEntry) => {
        const nameSpan = <span className="font-bold text-cyan-400">{log.name}</span>;
        
        switch (log.action) {
            case 'death':
                return t('log.death', { name: log.name });
            case 'eat_success':
                return t('log.eat_success', { name: log.name, amount: log.amount?.toFixed(0) || '0' });
            case 'eat_fail':
                return t('log.eat_fail', { name: log.name });
            case 'sleep_start':
                return t('log.sleep_start', { name: log.name });
            case 'wake_up':
                return t('log.wake_up', { name: log.name, reason: log.wake_reason || 'unknown' });
            case 'Simulation Started':
                return t('log.start');
            default:
                 return `${log.name} ${log.action}`;
        }
    };
    
    const formatMessage = (log: LogEntry) => {
        const message = getEventMessage(log);
        
        // FIX: The original implementation had a logic bug in an `if` block that was removed.
        // The block incorrectly stripped NPC names and made this recursive styling logic unreachable.
        // The type errors on lines 60 and 61 are fixed by adding a generic to `React.isValidElement`
        // to help TypeScript infer the type of `node.props`.
        const nameToReplace = log.name;
        
        const replaceName = (node: React.ReactNode): React.ReactNode => {
            if (typeof node === 'string') {
                if(node.includes(nameToReplace)) {
                    const parts = node.split(nameToReplace);
                    return parts.map((part, i) => i < parts.length - 1 ? <>{part}<span className="font-bold text-cyan-400">{nameToReplace}</span></> : part);
                }
                return node;
            }
             if (Array.isArray(node)) {
                return node.map(child => replaceName(child));
            }
            if (React.isValidElement<{ children?: React.ReactNode }>(node) && node.props.children) {
                 return React.cloneElement(node, { ...node.props, children: replaceName(node.props.children) });
            }
            return node;
        }
        return <p className="text-gray-300">{replaceName(message)}</p>;
    }


    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-3 text-cyan-300">{t('log.title')}</h2>
            <div className="h-48 overflow-y-auto bg-gray-900/50 rounded-md p-2 space-y-1 text-sm pr-2">
                {significantEvents.length === 0 && <p className="text-gray-500">{t('log.noEvents')}</p>}
                {significantEvents.map((log, index) => (
                    <div key={index} className="flex items-start">
                        <span className="text-gray-500 w-12 text-right mr-2 font-mono flex-shrink-0">T:{log.t}</span>
                        {formatMessage(log)}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventLog;