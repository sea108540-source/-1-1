import React, { useState, useEffect } from 'react';
import type { Item } from '../lib/types';
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
}

export const ItemForm: React.FC<ItemFormProps> = ({ isOpen, onClose, onSave, onDelete, initialData }) => {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [memo, setMemo] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('');
    const [priority, setPriority] = useState<'high' | 'mid' | 'low'>('mid');
    const [image, setImage] = useState<{ type: 'blob' | 'dataUrl' | 'url'; value: string } | undefined>(undefined);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setTitle(initialData.title);
                setUrl(initialData.url || '');
                setMemo(initialData.memo || '');
                setPrice(initialData.price || '');
                setCategory(initialData.category || '');
                setPriority(initialData.priority || 'mid');
                setImage(initialData.image);
            } else {
                setTitle('');
                setUrl('');
                setMemo('');
                setPrice('');
                setCategory('');
                setPriority('mid');
                setImage(undefined);
            }
        }
    }, [isOpen, initialData]);

    const handleSave = () => {
        const defaultTitle = title.trim() || '無題のアイテム';
        const item: Item = {
            id: initialData?.id || uuidv4(),
            title: defaultTitle,
            url: url.trim() || undefined,
            memo: memo.trim() || undefined,
            price: price.trim() || undefined,
            category: category.trim() || undefined,
            priority,
            image,
            createdAt: initialData?.createdAt || Date.now(),
            obtained: initialData?.obtained || false,
            obtainedAt: initialData?.obtainedAt,
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
                    label="URL"
                    type="url"
                    icon={<Link size={16} />}
                    placeholder="https://example.com/item"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                />

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

            </div>
        </Modal>
    );
};
