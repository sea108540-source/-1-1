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
    group_id?: string | null;
    is_public?: boolean;
    creator?: Profile;
    group?: { id: string; name: string };
};

export type Profile = {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    bio?: string | null;
    birthday?: string | null;
    updated_at?: string;
};

export type Group = {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
};
