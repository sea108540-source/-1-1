-- =====================================================================
-- avatars ストレージバケットのセットアップ
-- このSQLをSupabaseのSQL Editorで実行してください
-- =====================================================================

-- avatarsバケットを作成（既に存在する場合は無視）
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 既存のポリシーを削除してからシンプルなものを再作成
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar." ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar." ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar." ON storage.objects;

-- 全ユーザーがavatarsバケットの画像を閲覧できる
CREATE POLICY "Avatar images are publicly accessible." 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- ログイン済みユーザーであれば誰でもavatarsバケットにアップロードできる
CREATE POLICY "Users can upload their own avatar." 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.role() = 'authenticated'
);

-- ログイン済みユーザーならavatarsバケット内のファイルを更新できる
CREATE POLICY "Users can update their own avatar." 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'avatars' AND 
  auth.role() = 'authenticated'
);

-- ログイン済みユーザーならavatarsバケット内のファイルを削除できる
CREATE POLICY "Users can delete their own avatar." 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'avatars' AND 
  auth.role() = 'authenticated'
);
