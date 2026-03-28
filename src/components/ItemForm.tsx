import React, { useEffect, useRef, useState } from 'react';
import type { Group, Item } from '../lib/types';
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
    readOnly?: boolean;
}

type ItemImage = NonNullable<Item['image']>;
type MetadataResponse = {
    status?: string;
    data?: {
        title?: string;
        image?: {
            url?: string;
        };
    };
};

const PRIORITY_OPTIONS: Array<{ value: NonNullable<Item['priority']>; label: string }> = [
    { value: 'high', label: '高' },
    { value: 'mid', label: '中' },
    { value: 'low', label: '低' },
];

export const ItemForm: React.FC<ItemFormProps> = ({ isOpen, onClose, onSave, onDelete, initialData, groupId, readOnly }) => {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [memo, setMemo] = useState('');
    const [price, setPrice] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [category, setCategory] = useState('');
    const [priority, setPriority] = useState<NonNullable<Item['priority']>>('mid');
    const [image, setImage] = useState<ItemImage | undefined>(undefined);
    const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [isObtained, setIsObtained] = useState(false);
    const [obtainedDate, setObtainedDate] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchGroups = async () => {
            const data = await getGroups();
            setGroups(data);
        };

        void fetchGroups();
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const today = new Date().toISOString().split('T')[0];

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
            setIsObtained(initialData.obtained || false);
            setObtainedDate(initialData.obtainedAt ? new Date(initialData.obtainedAt).toISOString().split('T')[0] : today);
            return;
        }

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
        setIsObtained(false);
        setObtainedDate(today);
    }, [groupId, initialData, isOpen]);

    const fetchMetadata = async (targetUrl: string) => {
        if (!targetUrl.trim() || isFetchingMetadata) return;

        let validUrl: URL;
        try {
            validUrl = new URL(targetUrl.trim());
        } catch {
            return;
        }

        setIsFetchingMetadata(true);
        try {
            const apiEndpoint = `https://api.microlink.io/?url=${encodeURIComponent(validUrl.toString())}`;
            const response = await fetch(apiEndpoint);
            if (!response.ok) throw new Error('Failed to fetch metadata');

            const data = await response.json() as MetadataResponse;

            if (data.status === 'success' && data.data) {
                if (!title.trim() && data.data.title) {
                    setTitle(data.data.title);
                }

                if (!image && data.data.image?.url) {
                    setImage({ type: 'url', value: data.data.image.url });
                }
            }
        } catch (error) {
            console.error('Metadata fetch error:', error);
        } finally {
            setIsFetchingMetadata(false);
        }
    };

    const handleUrlBlur = () => {
        if (url && !initialData) {
            void fetchMetadata(url);
        }
    };

    const handleSave = () => {
        const obtainedTimestamp = isObtained
            ? (obtainedDate ? new Date(`${obtainedDate}T00:00:00`).getTime() : Date.now())
            : undefined;

        const item: Item = {
            id: initialData?.id || uuidv4(),
            title: title.trim() || '名前未設定のアイテム',
            url: url.trim() || undefined,
            memo: memo.trim() || undefined,
            price: price.trim() || undefined,
            target_date: targetDate || undefined,
            category: category.trim() || undefined,
            priority,
            image,
            createdAt: initialData?.createdAt || Date.now(),
            obtained: isObtained,
            obtainedAt: obtainedTimestamp,
            group_id: selectedGroupId || undefined,
            is_public: isPublic,
        };

        onSave(item);
        onClose();
    };

    const handlePaste = (event: React.ClipboardEvent) => {
        if (readOnly) return;

        event.preventDefault();
        const clipboardItems = event.clipboardData.items;

        for (let index = 0; index < clipboardItems.length; index += 1) {
            if (clipboardItems[index].type.includes('image')) {
                const blob = clipboardItems[index].getAsFile();
                if (!blob) return;

                const reader = new FileReader();
                reader.onload = loadEvent => {
                    if (loadEvent.target?.result) {
                        setImage({ type: 'dataUrl', value: loadEvent.target.result as string });
                    }
                };
                reader.readAsDataURL(blob);
                return;
            }
        }

        const textData = event.clipboardData.getData('text');
        if (!textData) return;

        if (textData.startsWith('http://') || textData.startsWith('https://')) {
            setUrl(previous => previous || textData);
            if (!initialData) {
                void fetchMetadata(textData);
            }
            return;
        }

        setTitle(previous => previous || textData);
    };

    const loadImageFile = (file?: File) => {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = event => {
            if (event.target?.result) {
                setImage({ type: 'dataUrl', value: event.target.result as string });
            }
        };
        reader.readAsDataURL(file);
    };

    const creatorName = initialData?.creator?.display_name || initialData?.creator?.username || 'ユーザー';
    const titleText = readOnly
        ? `${creatorName}のアイテム`
        : initialData
            ? 'アイテムを編集'
            : 'アイテムを追加';

    const footer = (
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
                {initialData && onDelete && !readOnly && (
                    <Button variant="danger" onClick={() => onDelete(initialData.id)}>
                        削除
                    </Button>
                )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="ghost" onClick={onClose}>
                    {readOnly ? '閉じる' : 'キャンセル'}
                </Button>
                {!readOnly && (
                    <Button variant="primary" onClick={handleSave}>
                        {initialData ? '更新する' : '追加する'}
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={titleText}
            footer={footer}
        >
            <div
                onPaste={handlePaste}
                onDrop={event => {
                    if (readOnly) return;
                    event.preventDefault();
                    loadImageFile(event.dataTransfer.files?.[0]);
                }}
                onDragOver={event => {
                    if (!readOnly) {
                        event.preventDefault();
                    }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem', outline: 'none' }}
                tabIndex={0}
            >
                {!readOnly && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                        URL を貼り付けると商品名と画像を自動取得します。画像のドラッグ&ドロップや `Ctrl+V` による貼り付けにも対応しています。
                    </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                        onClick={() => !readOnly && fileInputRef.current?.click()}
                        style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            border: '1px dashed var(--glass-border)',
                            flexShrink: 0,
                            cursor: readOnly ? 'default' : 'pointer',
                            transition: 'background 0.2s'
                        }}
                    >
                        {image ? (
                            <img src={image.value} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <ImagePlus size={24} color="var(--text-muted)" />
                        )}
                    </div>

                    {!readOnly && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={event => loadImageFile(event.target.files?.[0])}
                            />
                            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                                {image ? '画像を変更' : '画像を追加'}
                            </Button>
                            {image && (
                                <Button variant="ghost" size="sm" onClick={() => setImage(undefined)} style={{ color: 'var(--danger)' }}>
                                    画像を削除
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <Input
                    label="タイトル"
                    placeholder="欲しいものの名前"
                    value={title}
                    onChange={event => setTitle(event.target.value)}
                    autoFocus
                    readOnly={readOnly}
                />

                <Input
                    label="使いたい日 / 必要な日"
                    type="date"
                    value={targetDate}
                    onChange={event => setTargetDate(event.target.value)}
                    readOnly={readOnly}
                />

                <div className="input-group">
                    <label className="input-label" htmlFor="item-url-input" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        URL
                        {isFetchingMetadata && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 400, fontStyle: 'italic' }}>
                                読み込み中...
                            </span>
                        )}
                    </label>
                    <Input
                        id="item-url-input"
                        type="url"
                        icon={<Link size={16} />}
                        placeholder="https://example.com/item"
                        value={url}
                        onChange={event => setUrl(event.target.value)}
                        onBlur={handleUrlBlur}
                        readOnly={readOnly}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="input-wrapper" style={{ flex: '1 1 120px' }}>
                        <label className="input-label">優先度</label>
                        <select
                            className="input-field"
                            value={priority}
                            onChange={event => setPriority(event.target.value as NonNullable<Item['priority']>)}
                            disabled={readOnly}
                        >
                            {PRIORITY_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Input
                        label="カテゴリ"
                        placeholder="ガジェット、趣味、生活用品"
                        value={category}
                        onChange={event => setCategory(event.target.value)}
                        style={{ flex: 1 }}
                        readOnly={readOnly}
                    />
                </div>

                <Input
                    label="価格"
                    placeholder="例: 12,800円"
                    value={price}
                    onChange={event => setPrice(event.target.value)}
                    readOnly={readOnly}
                />

                {(memo || !readOnly) && (
                    <div className="input-wrapper">
                        <label className="input-label">メモ</label>
                        <textarea
                            className="input-field"
                            placeholder="補足メモ"
                            value={memo}
                            onChange={event => setMemo(event.target.value)}
                            readOnly={readOnly}
                        />
                    </div>
                )}

                {!readOnly && (
                    <div className="input-wrapper">
                        <label className="input-label">共有するグループ</label>
                        <select
                            className="input-field"
                            value={selectedGroupId}
                            onChange={event => setSelectedGroupId(event.target.value)}
                            disabled={!!groupId}
                        >
                            <option value="">選択しない</option>
                            {groups.map(group => (
                                <option key={group.id} value={group.id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {!groupId && !readOnly && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <input
                            type="checkbox"
                            id="is-public-toggle"
                            checked={isPublic}
                            onChange={event => setIsPublic(event.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <label htmlFor="is-public-toggle" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
                            このアイテムを公開プロフィールに表示する
                        </label>
                    </div>
                )}

                <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '0.5rem', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isObtained ? '0.75rem' : 0 }}>
                        <input
                            type="checkbox"
                            id="is-obtained-toggle"
                            checked={isObtained}
                            onChange={event => setIsObtained(event.target.checked)}
                            disabled={readOnly}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--success)', cursor: readOnly ? 'default' : 'pointer' }}
                        />
                        <label htmlFor="is-obtained-toggle" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--success)', cursor: readOnly ? 'default' : 'pointer', userSelect: 'none' }}>
                            すでに入手済みにする
                        </label>
                    </div>

                    {isObtained && (
                        <Input
                            label="入手日"
                            type="date"
                            value={obtainedDate}
                            onChange={event => setObtainedDate(event.target.value)}
                            readOnly={readOnly}
                            style={{ maxWidth: '200px' }}
                        />
                    )}
                </div>
            </div>
        </Modal>
    );
};
