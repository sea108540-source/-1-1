import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { supabase } from './supabase';
import type { Item, Profile } from './types';

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
});

// ========================
// CRUD Operations
// ========================

export const getItems = async (): Promise<Item[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false });
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
  const { error } = await supabase.from('friendships').insert({ friend_id: friendId });
  if (error) throw error;
};

export const getFriends = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('friendships')
    .select('friend_id, profiles!friendships_friend_id_fkey(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getFriends error:', error);
    return [];
  }
  return data.map((d: any) => d.profiles);
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
