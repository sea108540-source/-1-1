-- 1. profiles テーブル（ユーザーの公開情報）
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  username text UNIQUE,
  avatar_url text,
  bio text,
  birthday date,
  monthly_budget integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now()
);

-- 安全に birthday カラムを追加する処理 (既存テーブル用)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='birthday') THEN
    ALTER TABLE public.profiles ADD COLUMN birthday date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='monthly_budget') THEN
    ALTER TABLE public.profiles ADD COLUMN monthly_budget integer DEFAULT 0;
  END IF;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- groups テーブル
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- group_members テーブル
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- ユーティリティ関数（RLSの無限ループを回避するため）
CREATE OR REPLACE FUNCTION public.is_group_member(check_group_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = check_group_id AND user_id = auth.uid()
  );
$$;

-- Group RLS Policies
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;
CREATE POLICY "Users can view groups they are members of" 
ON public.groups FOR SELECT 
USING (
  created_by = auth.uid() OR public.is_group_member(id)
);

-- Users can insert groups
DROP POLICY IF EXISTS "Users can insert groups" ON public.groups;
CREATE POLICY "Users can insert groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can delete groups they created
DROP POLICY IF EXISTS "Users can delete own groups" ON public.groups;
CREATE POLICY "Users can delete own groups" ON public.groups FOR DELETE USING (auth.uid() = created_by);

-- Group Members RLS Policies
DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
CREATE POLICY "Users can view group members" 
ON public.group_members FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.is_group_member(group_id) OR
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
);

-- Users can insert members
DROP POLICY IF EXISTS "Users can add group members" ON public.group_members;
CREATE POLICY "Users can add group members" ON public.group_members FOR INSERT WITH CHECK (
  public.is_group_member(group_id)
  OR auth.uid() = (SELECT created_by FROM public.groups WHERE id = public.group_members.group_id)
);

-- A workaround for self-insertion when creating a group:
DROP POLICY IF EXISTS "Users can add themselves to a group" ON public.group_members;
CREATE POLICY "Users can add themselves to a group" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove members" ON public.group_members;
CREATE POLICY "Users can remove members" ON public.group_members FOR DELETE USING (
  auth.uid() = user_id OR auth.uid() = (SELECT created_by FROM public.groups WHERE id = public.group_members.group_id)
);

-- 2. friendships テーブル
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  friend_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='friendships' AND column_name='status') THEN
    ALTER TABLE public.friendships ADD COLUMN status text DEFAULT 'accepted';
    ALTER TABLE public.friendships ALTER COLUMN status SET DEFAULT 'pending';
  END IF;
END $$;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can add friends" ON public.friendships;
CREATE POLICY "Users can add friends" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their received requests" ON public.friendships;
CREATE POLICY "Users can update their received requests" ON public.friendships FOR UPDATE USING (auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can remove friends" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete their received requests" ON public.friendships;
CREATE POLICY "Users can remove friends" ON public.friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 3. items テーブル
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  url text,
  image_type text,
  image_value text,
  memo text,
  priority text,
  category text,
  price text,
  created_at bigint NOT NULL,
  obtained boolean NOT NULL DEFAULT false,
  obtained_at bigint,
  is_public boolean DEFAULT true
);

-- 安全にカラムを追加、および既存データの整合性をとる処理
DO $$
BEGIN
  -- カラム追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='group_id') THEN
    ALTER TABLE public.items ADD COLUMN group_id uuid REFERENCES public.groups ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='reserved_by') THEN
    ALTER TABLE public.items ADD COLUMN reserved_by uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='is_public') THEN
    ALTER TABLE public.items ADD COLUMN is_public boolean DEFAULT true;
  END IF;

  -- 整合性チェック: プロフィールがないユーザーのダミー作成
  INSERT INTO public.profiles (id, display_name)
  SELECT DISTINCT user_id, '新規ユーザー' FROM public.items 
  WHERE user_id NOT IN (SELECT id FROM public.profiles) ON CONFLICT (id) DO NOTHING;

  -- 整合性チェック: 存在しないユーザーの予約を解除
  UPDATE public.items SET reserved_by = NULL 
  WHERE reserved_by IS NOT NULL AND reserved_by NOT IN (SELECT id FROM public.profiles);

  -- 外部キー制約の再試行 (アプリが期待する名前で固定)
  ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_user_id_profiles_fkey;
  ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_user_id_fkey;
  ALTER TABLE public.items ADD CONSTRAINT items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_reserved_by_fkey;
  ALTER TABLE public.items ADD CONSTRAINT items_reserved_by_fkey FOREIGN KEY (reserved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

END $$;

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Select (自分または友達が見れる、そして同じグループのアイテムが見れる)
DROP POLICY IF EXISTS "Users can view their own items" ON public.items;
DROP POLICY IF EXISTS "Users can view their own or friends' items" ON public.items;
DROP POLICY IF EXISTS "Users can view their own or friends or group items" ON public.items;

CREATE POLICY "Users can view their own or friends or group items" 
ON public.items FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE user_id = auth.uid() AND friend_id = public.items.user_id AND public.items.group_id IS NULL
  ) OR
  (
    group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE user_id = auth.uid() AND group_id = public.items.group_id
    )
  )
);

-- Insert/Update/Delete (自分のみ または グループメンバー)
DROP POLICY IF EXISTS "Users can insert their own items" ON public.items;
DROP POLICY IF EXISTS "Users can insert their own items or group items" ON public.items;
CREATE POLICY "Users can insert their own items or group items" ON public.items FOR INSERT WITH CHECK (
  auth.uid() = user_id OR 
  (
    group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE user_id = auth.uid() AND group_id = public.items.group_id
    )
  )
);

DROP POLICY IF EXISTS "Users can update their own items" ON public.items;
DROP POLICY IF EXISTS "Users can update their own items or group items" ON public.items;
CREATE POLICY "Users can update their own items or group items" ON public.items FOR UPDATE USING (
  auth.uid() = user_id OR 
  (
    group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE user_id = auth.uid() AND group_id = public.items.group_id
    )
  ) OR
  EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (
      (user_id = auth.uid() AND friend_id = public.items.user_id) OR
      (friend_id = auth.uid() AND user_id = public.items.user_id)
    ) AND status = 'accepted'
  )
);

DROP POLICY IF EXISTS "Users can delete their own items" ON public.items;
DROP POLICY IF EXISTS "Users can delete their own items or group items" ON public.items;
CREATE POLICY "Users can delete their own items or group items" ON public.items FOR DELETE USING (
  auth.uid() = user_id OR 
  (
    group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE user_id = auth.uid() AND group_id = public.items.group_id
    )
  )
);

-- Public items can be viewed by anyone (for sharing profile via URL)
DROP POLICY IF EXISTS "Public items are viewable by everyone" ON public.items;
CREATE POLICY "Public items are viewable by everyone" ON public.items FOR SELECT USING (true);
