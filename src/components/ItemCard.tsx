import React from 'react';
import type { Item } from '../lib/types';
import { Badge } from './ui/Badge';
import { ExternalLink, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ItemCardProps {
    item: Item;
    onToggleObtained: (id: string, currentStatus: boolean) => void;
    onClick: (item: Item) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onToggleObtained, onClick }) => {

    const getPriorityBadge = (priority?: string) => {
        switch (priority) {
            case 'high': return <Badge variant="danger">High</Badge>;
            case 'mid': return <Badge variant="warning">Mid</Badge>;
            case 'low': return <Badge variant="info">Low</Badge>;
            default: return null;
        }
    };

    return (
        <div
            className={`glass-panel item-card ${item.obtained ? 'item-obtained' : ''}`}
            onClick={() => onClick(item)}
            style={{ cursor: 'pointer', padding: '1rem', transition: 'transform 0.2s', position: 'relative' }}
        >
            <div style={{ display: 'flex', gap: '1rem' }}>

                {/* Thumbnail Area */}
                <div style={{
                    width: '80px', height: '80px', flexShrink: 0,
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                    background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    {item.image ? (
                        <img src={item.image.value} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No Image</span>
                    )}
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                        <h3 style={{
                            margin: 0, fontSize: '1.125rem', fontWeight: 600,
                            color: item.obtained ? 'var(--text-muted)' : 'var(--text-primary)',
                            textDecoration: item.obtained ? 'line-through' : 'none',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                            {item.title || '無題のアイテム'}
                        </h3>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {getPriorityBadge(item.priority)}
                        </div>
                    </div>

                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {item.price && <span>{item.price}</span>}
                        {item.category && <Badge>{item.category}</Badge>}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={14} />
                            {format(item.createdAt, 'yyyy/MM/dd')}
                        </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        {item.url ? (
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}
                            >
                                <ExternalLink size={14} /> Link
                            </a>
                        ) : <div />}

                        <button
                            className={`btn btn-sm ${item.obtained ? 'btn-ghost' : 'btn-secondary'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleObtained(item.id, item.obtained);
                            }}
                            style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                            <CheckCircle2 size={16} color={item.obtained ? 'var(--success)' : 'inherit'} />
                            {item.obtained ? '入手済み' : '未入手'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
