import React from 'react';
import type { SocialGraphData } from '../types';
import { useTranslation } from '../contexts/LocalizationContext';

interface SocialNetworkGraphProps {
    data: SocialGraphData;
}

const SocialNetworkGraph: React.FC<SocialNetworkGraphProps> = ({ data }) => {
    const { t } = useTranslation();
    const width = 300;
    const height = 200;
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) / 2 - 20;

    const nodesWithPositions = data.nodes.map((node, i) => {
        const angle = (i / data.nodes.length) * 2 * Math.PI - Math.PI / 2;
        return {
            ...node,
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle),
        };
    });

    const nodeMap = new Map(nodesWithPositions.map(n => [n.id, n]));

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-3 text-cyan-300">{t('social.title')}</h2>
            <div className="flex justify-center items-center h-48 bg-gray-900/50 rounded-md">
                {data.nodes.length > 0 ? (
                <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
                    <g>
                        {data.links.map((link, i) => {
                            const sourceNode = nodeMap.get(link.source);
                            const targetNode = nodeMap.get(link.target);
                            if (!sourceNode || !targetNode) return null;
                            return (
                                <line
                                    key={i}
                                    x1={sourceNode.x}
                                    y1={sourceNode.y}
                                    x2={targetNode.x}
                                    y2={targetNode.y}
                                    stroke="rgba(156, 163, 175, 0.3)"
                                    strokeWidth={Math.max(0.5, link.value * 20)}
                                />
                            );
                        })}
                    </g>
                     <g>
                        {nodesWithPositions.map(node => (
                            <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                                <circle
                                    r="12"
                                    className={node.alive ? node.color.replace('text-', 'fill-').replace('400', '-500') : 'fill-gray-600'}
                                    stroke="rgba(255,255,255,0.5)"
                                    strokeWidth="1.5"
                                />
                                <text
                                    textAnchor="middle"
                                    y="4"
                                    fontSize="11"
                                    fill="white"
                                    className="font-bold pointer-events-none"
                                >
                                    {node.label.split('_')[1]}
                                </text>
                            </g>
                        ))}
                    </g>
                </svg>
                ) : <p className="text-gray-500">{t('social.noData')}</p>}
            </div>
        </div>
    );
};

export default SocialNetworkGraph;