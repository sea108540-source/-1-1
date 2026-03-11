-- 1. items テーブルに target_date を追加
ALTER TABLE public.items ADD COLUMN target_date DATE;

-- 2. calendar_events テーブルを作成
CREATE TABLE public.calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    is_annual BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) を有効化
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- 自分のカレンダーイベントを作成できるポリシー
CREATE POLICY "Users can create personal calendar events."
    ON public.calendar_events FOR INSERT
    WITH CHECK (auth.uid() = creator_id);

-- 自分が作成したカレンダーイベントを削除できるポリシー
CREATE POLICY "Users can delete their own calendar events."
    ON public.calendar_events FOR DELETE
    USING (auth.uid() = creator_id);

-- イベントの閲覧可能ポリシー: 自分が作成したもの、または自分が所属するグループのイベントを見ることができる
CREATE POLICY "Users can view relevant calendar events."
    ON public.calendar_events FOR SELECT
    USING (
        auth.uid() = creator_id 
        OR 
        group_id IN (
            SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
        )
    );

-- 自分が作成したイベントを更新できるポリシー
CREATE POLICY "Users can update their own calendar events."
    ON public.calendar_events FOR UPDATE
    USING (auth.uid() = creator_id);
