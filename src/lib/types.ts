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
    reserved_by?: string | null;
    reserver?: Profile;
    target_date?: string; // YYYY-MM-DD
};

export type CalendarEvent = {
    id: string;
    creator_id: string;
    group_id?: string | null;
    title: string;
    event_date: string; // YYYY-MM-DD
    is_annual: boolean;
    created_at: string;
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
    monthly_budget?: number | null;
    updated_at?: string;
};

export type Group = {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
};

export type FriendRequest = {
    id: string;
    sender_id: string;
    created_at: string;
    sender?: Profile;
};

export type MonthlyBudget = {
    id: string;
    user_id: string;
    month: string; // YYYY-MM
    budget: number;
    created_at: string;
    updated_at: string;
};
