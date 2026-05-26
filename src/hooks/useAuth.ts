import { useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const WELCOME_EMAIL_SENT_KEY = 'buyaspot_welcome_email_sent';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const welcomeEmailSentRef = useRef(false);

  // Send welcome email for first-time users
  const sendWelcomeEmail = async (currentUser: User) => {
    // Prevent duplicate sends within the same session
    if (welcomeEmailSentRef.current) return;

    // Check localStorage to avoid resending across page reloads
    const sentKey = `${WELCOME_EMAIL_SENT_KEY}_${currentUser.id}`;
    if (localStorage.getItem(sentKey)) return;

    // Check if this is a new user (created within last 60 seconds)
    const createdAt = new Date(currentUser.created_at).getTime();
    const now = Date.now();
    const isNewUser = now - createdAt < 60_000; // 60 seconds

    if (!isNewUser) {
      // Not a new user, mark as sent to avoid future checks
      localStorage.setItem(sentKey, 'true');
      return;
    }

    welcomeEmailSentRef.current = true;

    try {
      console.log('📧 Sending welcome email to new user...');
      const { error } = await supabase.functions.invoke('send-welcome-email', {});

      if (error) {
        console.error('Welcome email error:', error);
      } else {
        console.log('✅ Welcome email sent successfully');
      }
    } catch (err) {
      console.error('Failed to send welcome email:', err);
    } finally {
      // Mark as sent regardless of outcome to prevent spam
      localStorage.setItem(sentKey, 'true');
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Trigger welcome email on SIGNED_IN event for new users
        if (event === 'SIGNED_IN' && session?.user) {
          // Use setTimeout to avoid blocking the auth state change
          setTimeout(() => sendWelcomeEmail(session.user), 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    loading,
    signOut,
    isAuthenticated: !!user,
  };
};