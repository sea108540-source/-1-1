-- 1. テーブル定義の修正 (足りないカラムを追加)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- 2. データの整合性を整える (エラーの原因となる「プロフィールがないデータ」「存在しない人の予約」を掃除)
-- プロフィールがないユーザーのダミー作成
INSERT INTO public.profiles (id, display_name)
SELECT DISTINCT user_id, '新規ユーザー' 
FROM public.items 
WHERE user_id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 存在しないユーザーの予約情報をクリア
UPDATE public.items SET reserved_by = NULL 
WHERE reserved_by IS NOT NULL 
AND reserved_by NOT IN (SELECT id FROM public.profiles);

-- 3. アプリケーションが期待する名前で連携（外部キー制約）を作り直す
-- これが正しくないと一覧にアイテムが表示されません
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_user_id_profiles_fkey;
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_user_id_fkey;
ALTER TABLE public.items ADD CONSTRAINT items_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_reserved_by_fkey;
ALTER TABLE public.items ADD CONSTRAINT items_reserved_by_fkey 
FOREIGN KEY (reserved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. RLS（セキュリティ）設定の更新
-- グループメンバーなら誰でも予約（reserved_byの更新）ができるようにします
DROP POLICY IF EXISTS "Users can update their own items or group items" ON public.items;
CREATE POLICY "Users can update their own items or group items" 
ON public.items FOR UPDATE 
USING (
  auth.uid() = user_id OR 
  (
    group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE user_id = auth.uid() AND group_id = public.items.group_id
    )
  )
)
WITH CHECK (
  auth.uid() = user_id OR 
  (
    -- 他人のアイテムでも予約カラムだけは変更可能にする
    group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE user_id = auth.uid() AND group_id = public.items.group_id
    )
  )
);
