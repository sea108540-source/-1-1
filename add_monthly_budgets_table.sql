CREATE TABLE IF NOT EXISTS public.monthly_budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    budget INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, month)
);

ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monthly budgets"
    ON public.monthly_budgets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly budgets"
    ON public.monthly_budgets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly budgets"
    ON public.monthly_budgets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monthly budgets"
    ON public.monthly_budgets FOR DELETE
    USING (auth.uid() = user_id);
