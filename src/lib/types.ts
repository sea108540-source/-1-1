export type Item = {
    id: string; // UUID
    title: string;
    url?: string;
    image?: {
        type: 'blob' | 'dataUrl' | 'url';
        value: string;
    };
    memo?: string;
    priority?: 'high' | 'mid' | 'low';
    category?: string;
    price?: string;
    createdAt: number;
    obtained: boolean;
    obtainedAt?: number;
};

export type Profile = {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    updated_at?: string;
};
