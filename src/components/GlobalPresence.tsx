import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const GlobalPresence = () => {
  useEffect(() => {
    const room = supabase.channel('online-viewers');
    
    room.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const { data: { session } } = await supabase.auth.getSession();
        await room.track({ 
          online_at: new Date().toISOString(),
          user_id: session?.user?.id || null
        });
      }
    });

    return () => {
      supabase.removeChannel(room);
    };
  }, []);

  return null;
};
