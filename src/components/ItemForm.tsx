import React, { useState, useEffect } from 'react';
import type { Item, Group } from '../lib/types';
import { getGroups } from '../lib/db';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ImagePlus, Link } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ItemFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Item) => void;
    onDelete?: (id: string) => void;
    initialData?: Item | null;
    groupId?: string;
}

export const ItemForm: React.FC<ItemFormProps> = ({ isOpen, onClose, onSave, onDelete, initialData, groupId }) => {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [memo, setMemo] = useState('');
    const [price, setPrice] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [category, setCategory] = useState('');
    const [priority, setPriority] = useState<'high' | 'mid' | 'low'>('mid');
    const [image, setImage] = useState<{ type: 'blob' | 'dataUrl' | 'url'; value: string } | undefined>(undefined);
    const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
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
            if (initialData) {
                setTitle(initialData.title);
                setUrl(initialData.url || '');
                setMemo(initialData.memo || '');
                setPrice(initialData.price || '');
                setTargetDate(initialData.target_date || '');
                setCategory(initialData.category || '');
                setPriority(initialData.priority || 'mid');
                setImage(initialData.image);
                setIsPublic(initialData.is_public ?? true);
                setSelectedGroupId(initialData.group_id || groupId || '');
            } else {
                setTitle('');
                setUrl('');
                setMemo('');
                setPrice('');
                setTargetDate('');
                setCategory('');
                setPriority('mid');
                setImage(undefined);
                setIsFetchingMetadata(false);
                setIsPublic(true);
                setSelectedGroupId(groupId || '');
            }
        }
    }, [isOpen, initialData]);

    const fetchMetadata = async (targetUrl: string) => {
        if (!targetUrl.trim() || isFetchingMetadata) return;

        // Basic URL validation
        let validUrl;
        try {
            validUrl = new URL(targetUrl.trim());
        } catch (_) {
            return; // Invalid URL, do nothing
        }

        setIsFetchingMetadata(true);
        try {
            const apiEndpoint = `https://api.microlink.io/?url=${encodeURIComponent(validUrl.toString())}`;
            const res = await fetch(apiEndpoint);
            if (!res.ok) throw new Error('Failed to fetch metadata');
            const data = await res.json();

            if (data.status === 'success' && data.data) {
                // Only overwrite if current fields are empty to respect user input
                if (!title.trim() && data.data.title) {
                    setTitle(data.data.title);
                }

                // Only overwrite if no image is currently set
                if (!image && data.data.image?.url) {
                    setImage({ type: 'url', value: data.data.image.url });
                }
            }
        } catch (err) {
            console.error('Metadata fetch error:', err);
            // Ignore errors silently for UX, let them type manually
        } finally {
            setIsFetchingMetadata(false);
        }
    };

    const handleUrlBlur = () => {
        if (url && !initialData) {
            fetchMetadata(url);
        }
    };

    const handleSave = () => {
        const defaultTitle = title.trim() || '無題のアイテム';
        const item: Item = {
            id: initialData?.id || uuidv4(),
            title: defaultTitle,
            url: url.trim() || undefined,
            memo: memo.trim() || undefined,
            price: price.trim() || undefined,
            target_date: targetDate || undefined,
            category: category.trim() || undefined,
            priority,
            image,
            createdAt: initialData?.createdAt || Date.now(),
            obtained: initialData?.obtained || false,
            obtainedAt: initialData?.obtainedAt,
            group_id: selectedGroupId || undefined,
            is_public: isPublic,
        };
        onSave(item);
        onClose();
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const items = e.clipboardData.items;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (event.target?.result) {
                            setImage({ type: 'dataUrl', value: event.target.result as string });
                        }
                    };
                    reader.readAsDataURL(blob);
                    return;
                }
            }
        }

        const textData = e.clipboardData.getData('text');
        if (textData) {
            if (textData.startsWith('http://') || textData.startsWith('https://')) {
                setUrl((prev) => prev ? prev : textData);
                // Trigger metadata fetch on paste immediately if it's a new item
                if (!initialData) {
                    fetchMetadata(textData);
                }
            } else {
                setTitle((prev) => prev ? prev : textData);
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    setImage({ type: 'dataUrl', value: event.target.result as string });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    setImage({ type: 'dataUrl', value: event.target.result as string });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const footer = (
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
            <div>
                {initialData && onDelete && (
                    <Button variant="danger" onClick={() => onDelete(initialData.id)}>
                        削除
                    </Button>
                )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="ghost" onClick={onClose}>キャンセル</Button>
                <Button variant="primary" onClick={handleSave}>{initialData ? '更新する' : '追加する'}</Button>
            </div>
        </div>
    );

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'アイテムの編集' : '新しいアイテムを追加'} footer={footer}>
            <div
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem', outline: 'none' }}
                tabIndex={0}
            >
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Tip: クリップボード(Ctrl+V)やドラッグ＆ドロップ、または下の画像領域から追加できます。
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            width: '100px', height: '100px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', border: '1px dashed var(--glass-border)', flexShrink: 0,
                            cursor: 'pointer', transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    >
                        {image ? (
                            <img src={image.value} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <ImagePlus size={24} color="var(--text-muted)" />
                        )}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                            {image ? '画像を変更' : '画像を選択'}
                        </Button>
                        {image && (
                            <Button variant="ghost" size="sm" onClick={() => setImage(undefined)} style={{ color: 'var(--danger)' }}>画像を削除</Button>
                        )}
                    </div>
                </div>

                <Input
                    label="タイトル"
                    placeholder="欲しいものの名前"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    autoFocus
                />

                <Input
                    label="目標入手日 / 期日（任意）"
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                />

                <div className="input-group">
                    <label className="input-label" htmlFor="item-url-input" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        URL
                        {isFetchingMetadata && <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'normal', fontStyle: 'italic' }}>情報を取得中...</span>}
                    </label>
                    <Input
                        id="item-url-input"
                        type="url"
                        icon={<Link size={16} />}
                        placeholder="https://example.com/item"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        onBlur={handleUrlBlur}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="input-wrapper" style={{ flex: '1 1 120px' }}>
                        <label className="input-label">優先度</label>
                        <select className="input-field" value={priority} onChange={e => setPriority(e.target.value as any)}>
                            <option value="high">高</option>
                            <option value="mid">中</option>
                            <option value="low">低</option>
                        </select>
                    </div>
                    <Input
                        label="カテゴリ"
                        placeholder="ガジェット, 本..."
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        style={{ flex: 1 }}
                    />
                </div>

                <Input
                    label="価格"
                    placeholder="例: ¥12,800"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                />

                <div className="input-wrapper">
                    <label className="input-label">メモ</label>
                    <textarea
                        className="input-field"
                        placeholder="補足情報など"
                        value={memo}
                        onChange={e => setMemo(e.target.value)}
                    />
                </div>

                <div className="input-wrapper">
                    <label className="input-label">共有するグループ</label>
                    <select
                        className="input-field"
                        value={selectedGroupId}
                        onChange={e => setSelectedGroupId(e.target.value)}
                        disabled={!!groupId}
                    >
                        <option value="">（選択しない・個人用）</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                </div>

                {!groupId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <input
                            type="checkbox"
                            id="is-public-toggle"
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <label htmlFor="is-public-toggle" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                            このアイテムを友達に公開する
                        </label>
                    </div>
                )}

            </div>
        </Modal>
    );
};
