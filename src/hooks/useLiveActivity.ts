import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SIMULATION_NAMES } from '@/lib/names';

export interface ActivityEvent {
  id: number;
  message: string;
  emoji: string;
  type: 'buy' | 'resale' | 'premium' | 'click' | 'claim' | 'milestone' | 'explore' | 'trending';
  isReal: boolean;
}

const MAX_MESSAGES = 20;
const SIMULATION_INTERVAL_MIN = 3000;
const SIMULATION_INTERVAL_MAX = 6000;
const MEMORY_LIMIT_NAMES = 20;
const MEMORY_LIMIT_BRANDS = 10;

const EVENT_TEMPLATES = {
  visit: ['visited', 'checked out', 'looked at', 'browsed'],
  explore: ['explored'],
  claim: ['claimed a new spot for', 'registered', 'acquired a spot for'],
  buy: ['purchased', 'secured', 'claimed', 'booked']
};

export function useLiveActivity(isPaused: boolean) {
  const [messages, setMessages] = useState<ActivityEvent[]>([]);
  const pendingRealEvents = useRef<ActivityEvent[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>(['Pixel Studio', 'Future Feed', 'Urban Trends', 'Crypto Startup', 'AI Agency', 'Tech Blog']);
  
  const recentNames = useRef<string[]>([]);
  const recentBrands = useRef<string[]>([]);
  const lastCount = useRef<number>(0);

  // Fetch unique hostnames from pixel_blocks to use as realistic "Brands"
  useEffect(() => {
    const fetchBrands = async () => {
      const { data } = await supabase.from('pixel_blocks').select('link_url').not('link_url', 'is', null).limit(100);
      if (data && data.length > 0) {
        const uniqueDomains = new Set<string>();
        data.forEach(d => {
          try {
            if (d.link_url) {
              const url = new URL(d.link_url);
              let hostname = url.hostname;
              if (hostname.startsWith('www.')) hostname = hostname.slice(4);
              // Capitalize first letter
              hostname = hostname.charAt(0).toUpperCase() + hostname.slice(1);
              uniqueDomains.add(hostname);
            }
          } catch (e) {
            // Ignore invalid URLs
          }
        });
        if (uniqueDomains.size > 0) {
          setAvailableBrands(Array.from(uniqueDomains));
        }
      }
    };
    fetchBrands();
  }, []);

  // Subscribe to Real Events
  useEffect(() => {
    if (isPaused) return;

    const purchasesChannel = supabase
      .channel('ticker-purchases-lais')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pixel_blocks' }, async (payload) => {
        const block = payload.new as { owner_id?: string; pixel_count?: number; total_price?: number; alt_text?: string | null };
        let name = 'Someone';
        
        if (block.alt_text?.trim()) {
          name = block.alt_text.trim();
        } else if (block.owner_id) {
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', block.owner_id).maybeSingle();
          if (profile?.full_name) name = profile.full_name;
        }
        const count = block.pixel_count || 1;
        const price = Math.round(block.total_price || 0);
        
        const newMsg: ActivityEvent = {
          id: Date.now() + Math.random(),
          message: `${name} purchased ${count} pixel${count > 1 ? 's' : ''} for ₹${price.toLocaleString('en-IN')}`,
          emoji: count >= 20 ? '💎' : count >= 10 ? '🚀' : '🔥',
          type: count >= 20 ? 'premium' : 'buy',
          isReal: true,
        };
        pendingRealEvents.current.push(newMsg);
      })
      .subscribe();

    const clicksChannel = supabase
      .channel('ticker-clicks-lais')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pixel_clicks' }, async (payload) => {
        const click = payload.new as { block_id?: string; pixel_id?: string; };
        let link_url = null;
        let pixelType = 'a pixel';
        
        if (click.block_id) {
           const { data } = await supabase.from('pixel_blocks').select('link_url, total_price').eq('id', click.block_id).maybeSingle();
           if (data) {
             link_url = data.link_url;
             pixelType = data.total_price >= 499 ? 'a Gold Tier block' : (data.total_price >= 299 ? 'a Premium block' : 'an Economy block');
           }
        } else if (click.pixel_id) {
           const { data } = await supabase.from('pixels').select('link_url, price_paid').eq('id', click.pixel_id).maybeSingle();
           if (data) {
             link_url = data.link_url;
             pixelType = data.price_paid >= 499 ? 'a Gold pixel' : (data.price_paid >= 299 ? 'a Premium pixel' : 'an Economy pixel');
           }
        }

        if (link_url) {
          try {
            const urlObj = new URL(link_url);
            let hostname = urlObj.hostname;
            if (hostname.startsWith('www.')) hostname = hostname.slice(4);
            
            const newMsg: ActivityEvent = {
              id: Date.now() + Math.random(),
              message: `A user clicked ${pixelType} and visited ${hostname}`,
              emoji: '🖱️',
              type: 'click',
              isReal: true,
            };
            pendingRealEvents.current.push(newMsg);
          } catch (e) {
            // skip invalid URLs
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(purchasesChannel);
      supabase.removeChannel(clicksChannel);
    };
  }, [isPaused]);

  const generateSimulatedEvent = useCallback(() => {
    // 1. Pick a Name (respecting memory limit)
    let candidateName = '';
    for (let i = 0; i < 50; i++) {
      candidateName = SIMULATION_NAMES[Math.floor(Math.random() * SIMULATION_NAMES.length)];
      if (!recentNames.current.includes(candidateName)) break;
    }
    
    // 2. Pick a Brand (respecting memory limit)
    let candidateBrand = '';
    for (let i = 0; i < 50; i++) {
      candidateBrand = availableBrands[Math.floor(Math.random() * availableBrands.length)];
      if (!recentBrands.current.includes(candidateBrand)) break;
    }

    // Update memory
    recentNames.current.push(candidateName);
    if (recentNames.current.length > MEMORY_LIMIT_NAMES) recentNames.current.shift();

    recentBrands.current.push(candidateBrand);
    if (recentBrands.current.length > MEMORY_LIMIT_BRANDS) recentBrands.current.shift();

    // 3. Pick Event Type & Template
    const rand = Math.random();
    let type: ActivityEvent['type'] = 'explore';
    let emoji = '👀';
    let textTemplate = 'explored';
    
    if (rand < 0.4) {
      type = 'visit';
      emoji = '👁️';
      textTemplate = EVENT_TEMPLATES.visit[Math.floor(Math.random() * EVENT_TEMPLATES.visit.length)];
    } else if (rand < 0.7) {
      type = 'explore';
      emoji = '👀';
      textTemplate = EVENT_TEMPLATES.explore[Math.floor(Math.random() * EVENT_TEMPLATES.explore.length)];
    } else if (rand < 0.9) {
      type = 'buy';
      
      // Generate a realistic block count (mostly small 1-5, sometimes 6-12, rarely 15-20)
      let count = 1;
      let attempts = 0;
      do {
        const cRand = Math.random();
        if (cRand < 0.6) count = Math.floor(Math.random() * 5) + 1; // 1 to 5
        else if (cRand < 0.9) count = Math.floor(Math.random() * 7) + 6; // 6 to 12
        else count = Math.floor(Math.random() * 6) + 15; // 15 to 20
        attempts++;
      } while (count === lastCount.current && attempts < 5);
      
      lastCount.current = count;
      
      // Upgrade emoji based on size
      if (count >= 15) {
        emoji = '💎';
        type = 'premium';
      } else if (count >= 8) {
        emoji = '🚀';
      } else {
        emoji = '🔥';
      }

      textTemplate = `${EVENT_TEMPLATES.buy[Math.floor(Math.random() * EVENT_TEMPLATES.buy.length)]} ${count} block${count > 1 ? 's' : ''}`;
      candidateBrand = ''; // Not brand specific for general purchases in simulation
    } else {
      type = 'claim';
      emoji = '🎉';
      textTemplate = EVENT_TEMPLATES.claim[Math.floor(Math.random() * EVENT_TEMPLATES.claim.length)];
      candidateName = candidateBrand; // For claims, brand is the subject
      candidateBrand = '';
    }

    const message = candidateBrand ? `${candidateName} ${textTemplate} ${candidateBrand}` : `${candidateName} ${textTemplate}`;

    return {
      id: Date.now() + Math.random(),
      message,
      emoji,
      type,
      isReal: false,
    };
  }, [availableBrands]);

  // Feed processing loop
  useEffect(() => {
    if (isPaused) return;

    let timeoutId: NodeJS.Timeout;

    const processFeed = () => {
      let newEvent: ActivityEvent | null = null;

      if (pendingRealEvents.current.length > 0) {
        // High priority: real event
        newEvent = pendingRealEvents.current.shift() || null;
      } else {
        // Low priority: simulated event
        newEvent = generateSimulatedEvent();
      }

      if (newEvent) {
        setMessages(prev => {
          const newArr = [...prev, newEvent!];
          return newArr.length > MAX_MESSAGES ? newArr.slice(-MAX_MESSAGES) : newArr;
        });
      }

      // Schedule next processing with a random human-like delay (3.2s to 6.5s)
      const nextDelay = Math.floor(Math.random() * (SIMULATION_INTERVAL_MAX - SIMULATION_INTERVAL_MIN)) + SIMULATION_INTERVAL_MIN;
      timeoutId = setTimeout(processFeed, nextDelay);
    };

    // Initial kickoff
    timeoutId = setTimeout(processFeed, 1000);

    return () => clearTimeout(timeoutId);
  }, [isPaused, generateSimulatedEvent]);

  return { messages };
}
