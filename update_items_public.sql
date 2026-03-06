-- ==========================================
-- アイテムの「公開/非公開」機能追加のマイグレーション
-- ==========================================

-- 1. items テーブルに is_public カラムを追加（デフォルトはtrue）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='is_public') THEN
    ALTER TABLE public.items ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- 2. アイテムの閲覧(SELECT)ポリシーを更新して、is_public を反映する
-- (自分はすべて見れる、友達の場合は is_public = true のみ見れる、グループは常に共有されるという想定)
DROP POLICY IF EXISTS "Select_Items" ON public.items;
CREATE POLICY "Select_Items" ON public.items FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE user_id = auth.uid() AND friend_id = public.items.user_id AND public.items.group_id IS NULL AND public.items.is_public = true
  ) OR
  (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_groups()))
);

-- その他 Insert, Update, Delete は自分とグループの条件なので既存のままでOKですが念のため再定義
DROP POLICY IF EXISTS "Insert_Items" ON public.items;
CREATE POLICY "Insert_Items" ON public.items FOR INSERT WITH CHECK (
  user_id = auth.uid() OR 
  (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_groups()))
);

DROP POLICY IF EXISTS "Update_Items" ON public.items;
CREATE POLICY "Update_Items" ON public.items FOR UPDATE USING (
  user_id = auth.uid() OR 
  (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_groups()))
);

DROP POLICY IF EXISTS "Delete_Items" ON public.items;
CREATE POLICY "Delete_Items" ON public.items FOR DELETE USING (
  user_id = auth.uid() OR 
  (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_groups()))
);
