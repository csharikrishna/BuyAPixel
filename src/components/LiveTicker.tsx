import React, { useState, useEffect, useRef, useCallback, useMemo, CSSProperties } from 'react';
import { Pause, Play, Eye } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface TickerMessage {
  id: number;
  message: string;
  emoji: string;
  type: 'buy' | 'resale' | 'premium';
}

const LiveTicker: React.FC = () => {
  const location = useLocation();
  
  // ✅ MOVE ALL HOOKS BEFORE ANY CONDITIONAL RETURNS
  const [messages, setMessages] = useState<TickerMessage[]>([
    { id: 1, message: "TechCorp purchased 25 pixels for ₹2,475", emoji: "🔥", type: 'buy' },
    { id: 2, message: "StartupHub listed 10 pixels on marketplace", emoji: "🚀", type: 'resale' },
    { id: 3, message: "DigitalBrand secured premium spot for ₹4,950", emoji: "💎", type: 'premium' },
    { id: 4, message: "CreativeStudio just claimed 15 pixels", emoji: "✨", type: 'buy' },
    { id: 5, message: "MarketingPro bought premium pixels for ₹1,980", emoji: "🎯", type: 'premium' }
  ]);

  const [isPaused, setIsPaused] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const newMessagesPool = useMemo(() => [
    { message: "Anonymous bought 8 pixels for ₹792", emoji: "🔥", type: 'buy' as const },
    { message: "BrandX listed 20 pixels for resale", emoji: "🚀", type: 'resale' as const },
    { message: "TechStartup secured premium position", emoji: "💎", type: 'premium' as const },
    { message: "Designer_Pro claimed 5 pixels", emoji: "✨", type: 'buy' as const },
    { message: "CryptoWhale invested in 50 pixels", emoji: "💰", type: 'premium' as const },
    { message: "Marketing_Guru purchased 12 pixels", emoji: "🎯", type: 'buy' as const },
    { message: "StartupFounder bought premium spot", emoji: "⭐", type: 'premium' as const },
    { message: "DigitalAgency claimed 30 pixels", emoji: "🚀", type: 'buy' as const },
  ], []);

  const getViewerRangeByHour = useCallback((): [number, number] => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const minute = now.getMinutes();
    
    const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const viralDay = weekNumber % 7;
    const isViralDay = day === viralDay;
    
    const isWeekend = day === 0 || day === 6;
    const weekendMultiplier = isWeekend ? 1.3 : 1;
    
    let baseMin = 100;
    let baseMax = 300;
    
    if (hour >= 0 && hour < 6) {
      baseMin = 50;
      baseMax = 200;
    } else if (hour >= 6 && hour < 10) {
      baseMin = 150 + Math.floor((hour - 6) * 25);
      baseMax = 350;
    } else if (hour >= 10 && hour < 14) {
      baseMin = 300;
      baseMax = 700;
    } else if (hour >= 14 && hour < 18) {
      baseMin = 200;
      baseMax = 450;
    } else if (hour >= 18 && hour < 22) {
      if (isViralDay) {
        baseMin = 1500 + Math.floor((hour - 18) * 100);
        baseMax = 5000;
      } else {
        baseMin = 600 + Math.floor((hour - 18) * 100);
        baseMax = 2000;
      }
    } else if (hour >= 22) {
      baseMin = 150;
      baseMax = 400 - Math.floor((hour - 22) * 50);
    }
    
    baseMin = Math.floor(baseMin * weekendMultiplier);
    baseMax = Math.floor(baseMax * weekendMultiplier);
    
    const minuteVariance = Math.floor((minute / 60) * 50);
    baseMin += minuteVariance;
    
    return [baseMin, baseMax];
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const [min, max] = getViewerRangeByHour();
    const initialCount = Math.floor(Math.random() * (max - min + 1)) + min;
    
    if (isMountedRef.current) {
      setViewerCount(initialCount);
    }
  }, [getViewerRangeByHour]);

  useEffect(() => {
    const updateViewers = () => {
      if (!isMountedRef.current) return;
      
      setViewerCount(prev => {
        const [min, max] = getViewerRangeByHour();
        
        const rand = Math.random();
        let change;
        
        if (rand < 0.7) {
          change = Math.floor(Math.random() * 26) - 10;
        } else if (rand < 0.9) {
          change = Math.floor(Math.random() * 51) - 20;
        } else {
          change = Math.floor(Math.random() * 81) - 30;
        }
        
        let newCount = prev + change;
        
        const softMin = min - 20;
        const softMax = max + 30;
        
        newCount = Math.max(softMin, Math.min(softMax, newCount));
        
        if (newCount < min) {
          newCount += Math.floor((min - newCount) * 0.3);
        } else if (newCount > max) {
          newCount -= Math.floor((newCount - max) * 0.3);
        }
        
        newCount = Math.max(50, newCount);
        
        return Math.floor(newCount);
      });
      
      if (isMountedRef.current) {
        const randomInterval = Math.floor(Math.random() * 5000) + 2000;
        viewerTimerRef.current = setTimeout(updateViewers, randomInterval);
      }
    };

    updateViewers();
    
    return () => {
      if (viewerTimerRef.current) {
        clearTimeout(viewerTimerRef.current);
        viewerTimerRef.current = null;
      }
    };
  }, [getViewerRangeByHour]);

  useEffect(() => {
    if (isPaused || !isMountedRef.current) return;

    const addMessage = () => {
      if (!isMountedRef.current) return;
      
      const randomMsg = newMessagesPool[Math.floor(Math.random() * newMessagesPool.length)];
      setMessages(prev => {
        const newArr = [...prev, { id: Date.now(), ...randomMsg }];
        return newArr.length > 20 ? newArr.slice(-20) : newArr;
      });
    };

    const interval = Math.floor(Math.random() * 5000) + 7000;
    messageIntervalRef.current = setInterval(addMessage, interval);
    
    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = null;
      }
    };
  }, [isPaused, newMessagesPool]);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (viewerTimerRef.current) {
        clearTimeout(viewerTimerRef.current);
      }
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    };
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const tripledMessages = useMemo(() => {
    return [...messages, ...messages, ...messages];
  }, [messages]);

  const getStrongColor = useCallback((type: string) => {
    switch(type) {
      case 'premium': return '#8b5cf6';
      case 'buy': return '#10b981';
      case 'resale': return '#f59e0b';
      default: return '#6366f1';
    }
  }, []);

  const styles: { [key: string]: CSSProperties } = {
    wrapper: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      width: '100%',
      zIndex: 900,
      padding: isMobile ? '0' : '10px',
      pointerEvents: 'none',
    },
    glassPanel: {
      pointerEvents: 'auto',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTopWidth: '1px',
      borderTopStyle: 'solid',
      borderTopColor: 'rgba(0, 0, 0, 0.08)',
      borderRightWidth: isMobile ? '0' : '1px',
      borderRightStyle: 'solid',
      borderRightColor: 'rgba(0, 0, 0, 0.08)',
      borderBottomWidth: isMobile ? '0' : '1px',
      borderBottomStyle: 'solid',
      borderBottomColor: 'rgba(0, 0, 0, 0.08)',
      borderLeftWidth: isMobile ? '0' : '1px',
      borderLeftStyle: 'solid',
      borderLeftColor: 'rgba(0, 0, 0, 0.08)',
      borderRadius: isMobile ? '0' : '99px',
      boxShadow: '0 -2px 20px rgba(0,0,0,0.08)',
      display: 'flex',
      alignItems: 'center',
      height: isMobile ? '44px' : '48px',
      overflow: 'hidden',
      maxWidth: '1200px',
      margin: '0 auto',
      transform: 'translateZ(0)',
    },
    sidebar: {
      display: 'flex',
      alignItems: 'center',
      padding: isMobile ? '0 8px' : '0 12px',
      borderRightWidth: '1px',
      borderRightStyle: 'solid',
      borderRightColor: 'rgba(0, 0, 0, 0.08)',
      background: 'rgba(255,255,255,0.6)',
      height: '100%',
      flexShrink: 0,
      zIndex: 2,
      gap: isMobile ? '8px' : '12px',
    },
    liveBadge: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      background: '#fee2e2',
      color: '#ef4444',
      padding: isMobile ? '5px' : '4px 10px',
      borderRadius: '20px',
      fontSize: isMobile ? '0.7rem' : '0.75rem',
      fontWeight: 800,
      letterSpacing: '0.05em',
      userSelect: 'none',
    },
    liveDot: {
      width: '6px',
      height: '6px',
      backgroundColor: '#ef4444',
      borderRadius: '50%',
      animation: 'livePulse 2s ease-in-out infinite',
    },
    viewerCount: {
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '4px' : '5px',
      background: 'rgba(99, 102, 241, 0.12)',
      color: '#6366f1',
      padding: isMobile ? '5px 8px' : '5px 10px',
      borderRadius: '20px',
      fontSize: isMobile ? '0.7rem' : '0.75rem',
      fontWeight: 700,
      transition: 'transform 0.2s ease',
      userSelect: 'none',
      cursor: 'default',
    },
    viewerNumber: {
      fontVariantNumeric: 'tabular-nums',
      minWidth: isMobile ? '25px' : '30px',
      textAlign: 'right',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    controls: {
      display: isMobile ? 'none' : 'flex',
      gap: '6px',
    },
    iconBtn: {
      background: 'transparent',
      borderWidth: '0',
      borderStyle: 'none',
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#64748b',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      outline: 'none',
    },
    trackContainer: {
      flex: 1,
      overflow: 'hidden',
      position: 'relative',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      maskImage: 'linear-gradient(to right, transparent, black 20px, black 95%, transparent)',
      WebkitMaskImage: 'linear-gradient(to right, transparent, black 20px, black 95%, transparent)',
    },
    track: {
      display: 'flex',
      gap: isMobile ? '1.5rem' : '2rem',
      width: 'max-content',
      paddingLeft: '20px',
      willChange: 'transform',
    },
    card: {
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '6px' : '8px',
      fontSize: isMobile ? '0.85rem' : '0.9rem',
      color: '#334155',
      whiteSpace: 'nowrap',
      padding: '4px 0',
      userSelect: 'none',
    },
    emoji: {
      fontSize: isMobile ? '1rem' : '1.1rem',
      pointerEvents: 'none',
    },
    cardText: {
      lineHeight: 1.4,
    },
  };

  useEffect(() => {
    const styleId = 'live-ticker-animations';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes livePulse {
        0%, 100% { 
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
          opacity: 1;
        }
        50% { 
          box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
          opacity: 0.8;
        }
      }
      
      @keyframes scrollTicker {
        0% { transform: translateX(0); }
        100% { transform: translateX(-33.33%); }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      const elem = document.getElementById(styleId);
      if (elem) document.head.removeChild(elem);
    };
  }, []);

  // ✅ NOW CHECK PATH AND RETURN NULL AT THE END (after all hooks)
  const excludedPaths = ['/signin', '/signup', '/login', '/forgot-password', '/reset-password' , '/profile'];
  const shouldHideTicker = excludedPaths.some(path => 
    location.pathname.toLowerCase().includes(path.toLowerCase())
  );

  if (shouldHideTicker) {
    return null;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.glassPanel}>
        
        <div style={styles.sidebar}>
          <div style={styles.liveBadge}>
            <span style={styles.liveDot} aria-hidden="true"></span>
            {!isMobile && <span>LIVE</span>}
          </div>
          
          <div 
            style={styles.viewerCount} 
            aria-label={`${viewerCount} viewers online`}
            title={`${viewerCount} people viewing now`}
          >
            <Eye size={isMobile ? 12 : 14} aria-hidden="true" />
            <span style={styles.viewerNumber}>{viewerCount.toLocaleString()}</span>
          </div>
          
          {!isMobile && (
            <div style={styles.controls}>
              <button 
                style={styles.iconBtn}
                onClick={togglePause}
                aria-label={isPaused ? "Resume ticker" : "Pause ticker"}
                type="button"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                  e.currentTarget.style.color = '#6366f1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                {isPaused ? <Play size={16} /> : <Pause size={16} />}
              </button>
            </div>
          )}
        </div>

        <div style={styles.trackContainer} role="region" aria-live="polite" aria-label="Live activity feed">
          <div 
            style={{
              ...styles.track,
              animation: isPaused ? 'none' : 'scrollTicker 50s linear infinite',
            }}
            ref={scrollRef}
          >
            {tripledMessages.map((msg, index) => (
              <div 
                key={`${msg.id}-${index}`} 
                style={styles.card}
              >
                <span style={styles.emoji} aria-hidden="true">{msg.emoji}</span>
                <span style={styles.cardText}>
                  {msg.message.split(' ').map((word, i) => 
                    word.includes('₹') || word.match(/\d+/) 
                      ? <strong key={i} style={{ fontWeight: 700, color: getStrongColor(msg.type) }}>{word} </strong> 
                      : word + ' '
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default React.memo(LiveTicker);
