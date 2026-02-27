-- ==============================================================================
-- ⚠️ データベースのエラー（無限ループ）を完全に解消するための修正スクリプト ⚠️
-- ==============================================================================

-- 1. まず、既存のグループ関連のルール（ポリシー）をすべて削除してリセットします
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Users can update groups" ON public.groups;
DROP POLICY IF EXISTS "Users can delete groups" ON public.groups;

DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can add group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can add themselves to a group" ON public.group_members;
DROP POLICY IF EXISTS "Users can remove members" ON public.group_members;

DROP POLICY IF EXISTS "Users can view their own or friends or group items" ON public.items;
DROP POLICY IF EXISTS "Users can insert their own items or group items" ON public.items;
DROP POLICY IF EXISTS "Users can update their own items or group items" ON public.items;
DROP POLICY IF EXISTS "Users can delete their own items or group items" ON public.items;

-- 2. 無限ループを防ぐための特別な関数を作成します (SECURITY DEFINER でシステム権限で実行)
CREATE OR REPLACE FUNCTION public.get_my_groups()
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY SELECT group_id FROM public.group_members WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 新しい、安全なルールを作成します
-- ==========================================

-- ▼ groups (グループ本体) のルール
CREATE POLICY "Select_Groups" ON public.groups FOR SELECT USING (
  created_by = auth.uid() OR id IN (SELECT public.get_my_groups())
);
CREATE POLICY "Insert_Groups" ON public.groups FOR INSERT WITH CHECK (
  created_by = auth.uid()
);
CREATE POLICY "Update_Groups" ON public.groups FOR UPDATE USING (
  created_by = auth.uid()
);
CREATE POLICY "Delete_Groups" ON public.groups FOR DELETE USING (
  created_by = auth.uid()
);

-- ▼ group_members (グループメンバー) のルール
CREATE POLICY "Select_GroupMembers" ON public.group_members FOR SELECT USING (
  user_id = auth.uid() OR group_id IN (SELECT public.get_my_groups())
);
CREATE POLICY "Insert_GroupMembers" ON public.group_members FOR INSERT WITH CHECK (
  user_id = auth.uid() OR group_id IN (SELECT public.get_my_groups()) OR auth.uid() IN (SELECT created_by FROM public.groups WHERE id = group_id)
);
CREATE POLICY "Delete_GroupMembers" ON public.group_members FOR DELETE USING (
  user_id = auth.uid() OR auth.uid() IN (SELECT created_by FROM public.groups WHERE id = group_id)
);

-- ▼ items (アイテム) のルール (グループに紐づくアイテムの判定)
CREATE POLICY "Select_Items" ON public.items FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE user_id = auth.uid() AND friend_id = public.items.user_id AND public.items.group_id IS NULL
  ) OR
  (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_groups()))
);

CREATE POLICY "Insert_Items" ON public.items FOR INSERT WITH CHECK (
  user_id = auth.uid() OR 
  (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_groups()))
);

CREATE POLICY "Update_Items" ON public.items FOR UPDATE USING (
  user_id = auth.uid() OR 
  (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_groups()))
);

CREATE POLICY "Delete_Items" ON public.items FOR DELETE USING (
  user_id = auth.uid() OR 
  (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_groups()))
);
