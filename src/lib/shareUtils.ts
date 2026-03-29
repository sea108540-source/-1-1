import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Item } from './types';

type ShareableItem = Pick<Item, 'title' | 'url' | 'memo' | 'priority' | 'category' | 'price' | 'target_date'>;

export const generateShareLink = (items: Item[]): string => {
    const sharedItems: ShareableItem[] = items
        .filter(item => item.is_public !== false)
        .map(item => ({
            title: item.title,
            url: item.url,
            memo: item.memo,
            priority: item.priority,
            category: item.category,
            price: item.price,
            target_date: item.target_date,
        }));
    const jsonString = JSON.stringify(sharedItems);
    const compressed = compressToEncodedURIComponent(jsonString);
    const baseUrl = window.location.origin + window.location.pathname;

    return `${baseUrl}#share=${compressed}`;
};

export const parseSharedItemsFromUrl = (): Partial<Item>[] | null => {
    try {
        const hash = window.location.hash;
        if (!hash.startsWith('#share=')) {
            return null;
        }

        const compressed = hash.replace('#share=', '');
        const jsonString = decompressFromEncodedURIComponent(compressed);
        return jsonString ? JSON.parse(jsonString) : null;
    } catch (error) {
        console.error('Failed to parse shared items:', error);
        return null;
    }
};

export const exportDataAsJsonFile = (items: Item[]) => {
    const data = {
        version: 1,
        exportedAt: Date.now(),
        items,
    };

    const jsonString = JSON.stringify(data);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;

    const date = new Date();
    const dateString = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    link.download = `wishlist_export_${dateString}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const importDataFromJsonFile = async (file: File): Promise<Item[]> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const jsonString = event.target?.result as string;
                const data = JSON.parse(jsonString);

                if (data && Array.isArray(data.items)) {
                    resolve(data.items);
                } else {
                    reject(new Error('Invalid generic wishlist format'));
                }
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
