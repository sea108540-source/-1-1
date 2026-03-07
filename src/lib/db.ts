import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { supabase } from './supabase';
import type { Item, Profile, Group, FriendRequest } from './types';

const DB_NAME = 'WishlistDB';
const DB_VERSION = 1;
const STORE_NAME = 'items';

interface WishlistSchema extends DBSchema {
  items: {
    key: string;
    value: Item;
    indexes: {
      'by-createdAt': number;
      'by-priority': string;
      'by-obtained': number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<WishlistSchema>> | null = null;

export const getDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB<WishlistSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by-createdAt', 'createdAt');
          store.createIndex('by-priority', 'priority');
        }
      },
    });
  }
  return dbPromise;
};

// ========================
// Supabase Data Mappers
// ========================
const mapToDbItem = (item: Item, userId: string) => ({
  id: item.id,
  user_id: userId,
  title: item.title,
  url: item.url || null,
  image_type: item.image?.type || null,
  image_value: item.image?.value || null,
  memo: item.memo || null,
  priority: item.priority || null,
  category: item.category || null,
  price: item.price || null,
  created_at: item.createdAt,
  obtained: item.obtained,
  obtained_at: item.obtainedAt || null,
  group_id: item.group_id || null,
  is_public: item.is_public ?? true,
});

const mapFromDbItem = (row: any): Item => ({
  id: row.id,
  title: row.title,
  url: row.url || undefined,
  image: row.image_type && row.image_value ? { type: row.image_type, value: row.image_value } : undefined,
  memo: row.memo || undefined,
  priority: row.priority || undefined,
  category: row.category || undefined,
  price: row.price || undefined,
  createdAt: row.created_at,
  obtained: row.obtained,
  obtainedAt: row.obtained_at || undefined,
  group_id: row.group_id || undefined,
  is_public: row.is_public ?? true,
  creator: row.profiles || undefined,
  group: row.groups || undefined,
});

// ========================
// CRUD Operations
// ========================

export const getItems = async (): Promise<Item[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const { data, error } = await supabase
      .from('items')
      .select('*, groups(id, name)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error('Supabase fetch error:', error); return []; }
    return data.map(mapFromDbItem);
  }
  const db = await getDB();
  return db.getAll(STORE_NAME);
};

export const getItemById = async (id: string): Promise<Item | undefined> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const { data, error } = await supabase.from('items').select('*').eq('id', id).single();
    if (error || !data) return undefined;
    return mapFromDbItem(data);
  }
  const db = await getDB();
  return db.get(STORE_NAME, id);
};

export const addItem = async (item: Item): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const { error } = await supabase.from('items').insert(mapToDbItem(item, session.user.id));
    if (error) { console.error('Supabase insert error:', error); throw error; }
    return item.id;
  }
  const db = await getDB();
  await db.add(STORE_NAME, item);
  return item.id;
};

export const updateItem = async (item: Item): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const { error } = await supabase.from('items').update(mapToDbItem(item, session.user.id)).eq('id', item.id);
    if (error) { console.error('Supabase update error:', error); throw error; }
    return item.id;
  }
  const db = await getDB();
  await db.put(STORE_NAME, item);
  return item.id;
};

export const deleteItem = async (id: string): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) console.error('Supabase delete error:', error);
    return;
  }
  const db = await getDB();
  await db.delete(STORE_NAME, id);
};

export const clearAllItems = async (): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const { error } = await supabase.from('items').delete().eq('user_id', session.user.id);
    if (error) console.error('Supabase clear error:', error);
    return;
  }
  const db = await getDB();
  await db.clear(STORE_NAME);
};

export const addMultipleItems = async (items: Item[]): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const rows = items.map(item => mapToDbItem(item, session!.user!.id));
    const { error } = await supabase.from('items').insert(rows);
    if (error) console.error('Supabase insert multiple error:', error);
    return;
  }
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const item of items) {
    tx.store.add(item);
  }
  await tx.done;
};

// ========================
// Profile & Friends
// ========================

export const getProfile = async (id: string): Promise<Profile | null> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error) return null;
  return data;
};

export const updateProfile = async (profile: Partial<Profile> & { id: string }) => {
  const { error } = await supabase.from('profiles').upsert(profile);
  if (error) throw error;
};

export const searchUserByUsername = async (username: string): Promise<Profile | null> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('username', username).single();
  if (error) return null;
  return data;
};

export const addFriend = async (friendId: string) => {
  // Check if there is already a pending request from the other side
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not logged in');

  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .eq('user_id', friendId)
    .eq('friend_id', session.user.id)
    .single();

  if (existing) {
    if (existing.status === 'pending') {
      // Auto-accept if they already requested us
      await acceptFriendRequest(existing.id);
      return;
    }
    // Already accepted
    return;
  }

  // Insert pending request
  const { error } = await supabase.from('friendships').insert({ friend_id: friendId, status: 'pending' });
  if (error) {
    // Ignore duplicate error if we already sent a request
    if (error.code !== '23505') throw error;
  }
};

export const getFriends = async (): Promise<Profile[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  // Fetch accepted friendships involving the current user (RLS allows seeing where user_id or friend_id equals our uid)
  const { data: friendships, error: friendError } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });

  if (friendError) {
    console.error('getFriends error fetching friendships:', friendError);
    return [];
  }

  if (!friendships || friendships.length === 0) return [];

  // The friend's ID is the one that is not our ID
  const friendIds = friendships.map(f => f.user_id === session.user.id ? f.friend_id : f.user_id);

  // Fetch profiles
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', friendIds);

  if (profileError) {
    console.error('getFriends error fetching profiles:', profileError);
    return [];
  }

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const orderedProfiles = friendIds.map(id => profileMap.get(id)).filter(Boolean) as Profile[];

  return orderedProfiles;
};

export const getFriendRequests = async (): Promise<FriendRequest[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data: requests, error } = await supabase
    .from('friendships')
    .select('id, user_id, created_at')
    .eq('friend_id', session.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !requests) return [];

  const senderIds = requests.map(r => r.user_id);
  if (senderIds.length === 0) return [];

  const { data: profiles } = await supabase.from('profiles').select('*').in('id', senderIds);
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  return requests.map(r => ({
    id: r.id,
    sender_id: r.user_id,
    created_at: r.created_at,
    sender: profileMap.get(r.user_id)
  }));
};

export const acceptFriendRequest = async (friendshipId: string) => {
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
  if (error) throw error;
};

export const rejectFriendRequest = async (friendshipId: string) => {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
};

export const removeFriend = async (friendId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  // Try to delete both possible directions
  const { error: err1 } = await supabase.from('friendships').delete().match({ user_id: session.user.id, friend_id: friendId });
  const { error: err2 } = await supabase.from('friendships').delete().match({ user_id: friendId, friend_id: session.user.id });

  if (err1) throw err1;
  if (err2) throw err2;
};

export const getFriendItems = async (friendId: string): Promise<Item[]> => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', friendId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getFriendItems error:', error);
    return [];
  }
  return data.map(mapFromDbItem);
};

// ========================
// Groups
// ========================

export const createGroup = async (name: string): Promise<Group | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not logged in');

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ name, created_by: session.user.id })
    .select()
    .single();

  if (groupError) {
    console.error('Error creating group:', groupError);
    throw groupError;
  }

  // Add the creator as the first member
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: session.user.id });

  if (memberError) {
    console.error('Error adding creator to group members:', memberError);
    throw memberError;
  }

  return group;
};

export const getGroups = async (): Promise<Group[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('groups')
    .select('*, group_members!inner(user_id)')
    .eq('group_members.user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching groups:', error);
    return [];
  }

  // Remove the joined data from the type to match Group type
  return data.map((g: any) => ({
    id: g.id,
    name: g.name,
    created_by: g.created_by,
    created_at: g.created_at
  }));
};

export const getGroupMembers = async (groupId: string): Promise<Profile[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('group_members')
    .select('profiles!inner(*)')
    .eq('group_id', groupId);

  if (error) {
    console.error('Error fetching group members:', error);
    return [];
  }

  return data.map((d: any) => d.profiles);
};

export const addGroupMember = async (groupId: string, userId: string) => {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId });

  if (error) throw error;
};

export const getGroupItems = async (groupId: string): Promise<Item[]> => {
  // 1. Fetch the items for the group
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('getGroupItems error:', error);
    return [];
  }

  // 2. Fetch profiles for the unique user_ids in the items
  const userIds = Array.from(new Set(data.map(item => item.user_id).filter(Boolean)));

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  if (profileError) {
    console.error('Error fetching group item profiles:', profileError);
  }

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  // 3. Map manually, attaching the creator profile
  return data.map(row => mapFromDbItem({
    ...row,
    profiles: profileMap.get(row.user_id) || undefined
  }));
};
