import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { getGroups } from '../../lib/db';
import type { CalendarEvent, Group } from '../../lib/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

interface EventFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (eventData: Omit<CalendarEvent, 'id' | 'created_at' | 'creator_id' | 'creator' | 'group'>) => void;
    initialDate?: Date;
}

export const EventForm: React.FC<EventFormProps> = ({ isOpen, onClose, onSave, initialDate }) => {
    const [title, setTitle] = useState('');
    const [eventDate, setEventDate] = useState(initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    const [isAnnual, setIsAnnual] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');

    useEffect(() => {
        const fetchGroups = async () => {
            const data = await getGroups();
            setGroups(data);
        };

        void fetchGroups();
    }, []);

    const handleSave = () => {
        if (!title.trim() || !eventDate) return;

        onSave({
            title: title.trim(),
            event_date: eventDate,
            is_annual: isAnnual,
            group_id: selectedGroupId || null
        });
        onClose();
    };

    if (!isOpen) return null;

    const footer = (
        <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="ghost" onClick={onClose}>
                キャンセル
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!title.trim() || !eventDate}>
                追加する
            </Button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="イベントを追加" footer={footer}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', outline: 'none' }}>
                <Input
                    label="イベント名"
                    placeholder="例: 誕生日、記念日、送別会"
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
                        onChange={e => setIsAnnual(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <label htmlFor="is-annual-toggle" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                        毎年くり返す
                    </label>
                </div>

                <div className="input-wrapper" style={{ marginTop: '0.5rem' }}>
                    <label className="input-label">共有するグループ</label>
                    <select className="input-field" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
                        <option value="">選択しない</option>
                        {groups.map(group => (
                            <option key={group.id} value={group.id}>
                                {group.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </Modal>
    );
};
