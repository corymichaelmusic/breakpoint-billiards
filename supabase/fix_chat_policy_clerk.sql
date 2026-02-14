-- Update policy to use auth.jwt() ->> 'sub' instead of auth.uid()
-- auth.uid() crashes because it tries to cast Clerk IDs ('user_...') to UUID

DROP POLICY IF EXISTS "Users can manage their own read status" ON public.chat_read_status;

CREATE POLICY "Users can manage their own read status" ON public.chat_read_status
    FOR ALL USING ( (auth.jwt() ->> 'sub') = user_id );
