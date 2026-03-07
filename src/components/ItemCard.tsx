import React from 'react';
import type { Item } from '../lib/types';
import { Badge } from './ui/Badge';
import { ExternalLink, CheckCircle2, Clock, Lock, Users } from 'lucide-react';
import { format } from 'date-fns';

interface ItemCardProps {
    item: Item;
    currentUserId?: string; // To check if current user is the creator or reserver
    onToggleObtained: (id: string, currentStatus: boolean) => void;
    onClick: (item: Item) => void;
    onReserve?: (id: string) => void;
    onCancelReservation?: (id: string) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, currentUserId, onToggleObtained, onClick, onReserve, onCancelReservation }) => {

    const getPriorityBadge = (priority?: string) => {
        switch (priority) {
            case 'high': return <Badge variant="danger">High</Badge>;
            case 'mid': return <Badge variant="warning">Mid</Badge>;
            case 'low': return <Badge variant="info">Low</Badge>;
            default: return null;
        }
    };

    const isCreator = currentUserId === item.creator?.id;
    const isReserved = !!item.reserved_by;
    const isReservedByMe = isReserved && item.reserved_by === currentUserId;
    const isOtherReserved = isReserved && !isReservedByMe;

    return (
        <div
            className={`glass-panel item-card ${item.obtained ? 'item-obtained' : ''} ${isOtherReserved && !isCreator ? 'item-reserved' : ''}`}
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
                            {/* 自分が見ているときには予約状態を隠す (isCreator) */}
                            {!isCreator && isReserved && (
                                <span style={{
                                    fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px',
                                    backgroundColor: isReservedByMe ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                    color: isReservedByMe ? 'white' : 'var(--text-secondary)'
                                }}>
                                    {isReservedByMe ? 'あなたが予約中' : `${item.reserver?.display_name || item.reserver?.username || '他メンバー'}が予約済`}
                                </span>
                            )}
                            {item.is_public === false && (
                                <span title="非公開" style={{ color: 'var(--text-muted)' }}>
                                    <Lock size={16} />
                                </span>
                            )}
                            {getPriorityBadge(item.priority)}
                        </div>
                    </div>

                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {item.price && <span>{item.price}</span>}
                        {item.category && <Badge>{item.category}</Badge>}
                        {item.group && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', fontWeight: 500, background: 'rgba(var(--primary-rgb, 14, 165, 233), 0.1)', padding: '2px 8px', borderRadius: '12px' }} title="グループ">
                                <Users size={12} />
                                <span style={{ fontSize: '0.75rem' }}>{item.group.name}</span>
                            </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={14} />
                            {format(item.createdAt, 'yyyy/MM/dd')}
                        </span>
                        {item.creator && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '12px', border: '1px solid var(--glass-border)' }} title="追加した人">
                                {item.creator.avatar_url ? (
                                    <img src={item.creator.avatar_url} style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" />
                                ) : (
                                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '9px', fontWeight: 'bold' }}>
                                        {(item.creator.username || item.creator.display_name || '?').charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{item.creator.username || item.creator.display_name}</span>
                            </span>
                        )}
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

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                            {/* 予約アクション領域 (本人は見えない) */}
                            {!isCreator && !item.obtained && (
                                <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.25rem' }}>
                                    {!isReserved && onReserve && (
                                        <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); onReserve(item.id); }}>
                                            購入を予約
                                        </button>
                                    )}
                                    {isReservedByMe && onCancelReservation && (
                                        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); onCancelReservation(item.id); }} style={{ color: 'var(--danger)' }}>
                                            予約取消
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* 入手済みトグルボタン: 
                                自分が作成者(isCreator) なら常に操作可能。
                                自分が予約者(isReservedByMe) なら操作可能。
                                それ以外(予約されていない他人のアイテム、他人が予約中のアイテム等)は「入手済みにする」操作はできない(もしくは表示だけ)
                            */}
                            {(isCreator || isReservedByMe || item.obtained) && (
                                <button
                                    className={`btn btn-sm ${item.obtained ? 'btn-ghost' : 'btn-secondary'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // 他人のアイテムで予約もしていないのに押せないようにする（念のため）
                                        if (isCreator || isReservedByMe) {
                                            onToggleObtained(item.id, item.obtained);
                                        }
                                    }}
                                    disabled={!isCreator && !isReservedByMe}
                                    style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', opacity: (!isCreator && !isReservedByMe && !item.obtained) ? 0.5 : 1 }}
                                >
                                    <CheckCircle2 size={16} color={item.obtained ? 'var(--success)' : 'inherit'} />
                                    {item.obtained ? '入手済み' : (isReservedByMe ? 'プレゼントした' : '未入手')}
                                </button>
                            )}
                            {item.obtained && item.obtainedAt && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Clock size={10} />
                                    {format(item.obtainedAt, 'yyyy/MM/dd HH:mm')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
