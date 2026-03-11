import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { getGroups } from '../../lib/db';
import type { Group } from '../../lib/types';
import { format } from 'date-fns';

interface EventFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (eventData: any) => void;
    initialDate?: Date;
}

export const EventForm: React.FC<EventFormProps> = ({ isOpen, onClose, onSave, initialDate }) => {
    const [title, setTitle] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [isAnnual, setIsAnnual] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');

    useEffect(() => {
        const fetchGroups = async () => {
            const data = await getGroups();
            setGroups(data);
        };
        fetchGroups();
    }, []);

    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setEventDate(initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
            setIsAnnual(false);
            setSelectedGroupId('');
        }
    }, [isOpen, initialDate]);

    const handleSave = () => {
        if (!title.trim() || !eventDate) return;

        const eventData = {
            title: title.trim(),
            event_date: eventDate,
            is_annual: isAnnual,
            group_id: selectedGroupId || null
        };
        
        onSave(eventData);
        onClose();
    };

    const footer = (
        <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="ghost" onClick={onClose}>キャンセル</Button>
            <Button variant="primary" onClick={handleSave} disabled={!title.trim() || !eventDate}>
                追加する
            </Button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="記念日・イベントの追加" footer={footer}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', outline: 'none' }}>
                
                <Input
                    label="イベント名"
                    placeholder="例: 付き合って1年記念, Aさんの誕生日"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    autoFocus
                />

                <Input
                    label="日付"
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    required
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <input
                        type="checkbox"
                        id="is-annual-toggle"
                        checked={isAnnual}
                        onChange={(e) => setIsAnnual(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <label htmlFor="is-annual-toggle" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                        毎年繰り返す（誕生日など）
                    </label>
                </div>

                <div className="input-wrapper" style={{ marginTop: '0.5rem' }}>
                    <label className="input-label">共有するグループ（任意）</label>
                    <select
                        className="input-field"
                        value={selectedGroupId}
                        onChange={e => setSelectedGroupId(e.target.value)}
                    >
                        <option value="">（選択しない・自分のみ）</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>

            </div>
        </Modal>
    );
};
