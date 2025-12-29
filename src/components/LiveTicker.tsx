import React, { useState, useEffect, useRef, useCallback, useMemo, CSSProperties } from 'react';
import { Pause, Play, Eye, ChevronUp, Maximize2, GripVertical } from 'lucide-react';
import { useLocation } from 'react-router-dom';

// Constants
const ANIMATION_DURATION = 50; // seconds
const MAX_MESSAGES = 20;
const MESSAGE_INTERVAL_MIN = 7000;
const MESSAGE_INTERVAL_MAX = 12000;
const VIEWER_UPDATE_MIN = 2000;
const VIEWER_UPDATE_MAX = 7000;
const RESIZE_DEBOUNCE_MS = 150;
const MOBILE_BREAKPOINT = 768;

interface TickerMessage {
  id: number;
  message: string;
  emoji: string;
  type: 'buy' | 'resale' | 'premium';
}

interface Position {
  x: number;
  y: number;
}

const LiveTicker: React.FC = () => {
  const location = useLocation();
  
  // Load minimized state and position from localStorage
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('ticker-minimized');
    return saved === 'true';
  });

  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem('ticker-position');
    if (saved) {
      return JSON.parse(saved);
    }
    // Default to bottom-left area
    return { 
      x: 20, 
      y: window.innerHeight - 80 
    };
  });
  
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
  const [isHovering, setIsHovering] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const elementStartPos = useRef<Position>({ x: 0, y: 0 });

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

  // --- DRAG HANDLERS ---

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isMinimized || !dragRef.current) return;
    
    // preventDefault is okay here for mouse events
    e.preventDefault(); 
    setIsDragging(true);
    
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY
    };
    
    elementStartPos.current = {
      x: position.x,
      y: position.y
    };
  }, [isMinimized, position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragRef.current) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;
    
    let newX = elementStartPos.current.x + deltaX;
    let newY = elementStartPos.current.y + deltaY;
    
    const maxX = window.innerWidth - dragRef.current.offsetWidth;
    const maxY = window.innerHeight - dragRef.current.offsetHeight;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('ticker-position', JSON.stringify(position));
    }
  }, [isDragging, position]);

  // --- TOUCH HANDLERS (FIXED) ---

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMinimized || !dragRef.current) return;
    
    // FIX: Removed e.preventDefault() here. 
    // The CSS 'touch-action: none' handles the scroll blocking.
    // Calling preventDefault on a passive React listener causes the crash.
    
    const touch = e.touches[0];
    setIsDragging(true);
    
    dragStartPos.current = {
      x: touch.clientX,
      y: touch.clientY
    };
    
    elementStartPos.current = {
      x: position.x,
      y: position.y
    };
  }, [isMinimized, position]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !dragRef.current) return;
    
    // FIX: We can preventDefault here because this listener 
    // is attached via addEventListener with { passive: false } below
    if (e.cancelable) {
      e.preventDefault();
    }
    
    const touch = e.touches[0];
    
    const deltaX = touch.clientX - dragStartPos.current.x;
    const deltaY = touch.clientY - dragStartPos.current.y;
    
    let newX = elementStartPos.current.x + deltaX;
    let newY = elementStartPos.current.y + deltaY;
    
    const maxX = window.innerWidth - dragRef.current.offsetWidth;
    const maxY = window.innerHeight - dragRef.current.offsetHeight;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('ticker-position', JSON.stringify(position));
    }
  }, [isDragging, position]);

  // Attach global listeners for drag operations
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Important: { passive: false } allows us to prevent scrolling during the drag
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Update position on window resize to keep within bounds
  useEffect(() => {
    const handleResize = () => {
      if (!dragRef.current || !isMinimized) return;
      
      setPosition(prev => {
        const maxX = window.innerWidth - dragRef.current!.offsetWidth;
        const maxY = window.innerHeight - dragRef.current!.offsetHeight;
        
        return {
          x: Math.max(0, Math.min(prev.x, maxX)),
          y: Math.max(0, Math.min(prev.y, maxY))
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMinimized]);

  // --- VIEWER COUNT LOGIC ---

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

  // Debounced resize handler for mobile check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    
    let timeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(checkMobile, RESIZE_DEBOUNCE_MS);
    };
    
    checkMobile();
    window.addEventListener('resize', debouncedResize);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  // Sync minimized state across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ticker-minimized' && e.newValue !== null) {
        setIsMinimized(e.newValue === 'true');
      }
      if (e.key === 'ticker-position' && e.newValue !== null) {
        setPosition(JSON.parse(e.newValue));
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initialize viewer count
  useEffect(() => {
    const [min, max] = getViewerRangeByHour();
    const initialCount = Math.floor(Math.random() * (max - min + 1)) + min;
    setViewerCount(initialCount);
  }, [getViewerRangeByHour]);

  // Update viewer count periodically
  useEffect(() => {
    const updateViewers = () => {
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
    };

    const randomInterval = Math.floor(Math.random() * (VIEWER_UPDATE_MAX - VIEWER_UPDATE_MIN)) + VIEWER_UPDATE_MIN;
    const timer = setTimeout(updateViewers, randomInterval);
    
    return () => clearTimeout(timer);
  }, [viewerCount, getViewerRangeByHour]);

  // Add new messages periodically
  useEffect(() => {
    if (isPaused) return;

    const addMessage = () => {
      const randomMsg = newMessagesPool[Math.floor(Math.random() * newMessagesPool.length)];
      setMessages(prev => {
        const newArr = [...prev, { id: Date.now(), ...randomMsg }];
        return newArr.length > MAX_MESSAGES ? newArr.slice(-MAX_MESSAGES) : newArr;
      });
    };

    const interval = Math.floor(Math.random() * (MESSAGE_INTERVAL_MAX - MESSAGE_INTERVAL_MIN)) + MESSAGE_INTERVAL_MIN;
    const timer = setInterval(addMessage, interval);
    
    return () => clearInterval(timer);
  }, [isPaused, newMessagesPool]);

  // Update announcement for screen readers
  useEffect(() => {
    if (messages.length > 0 && !isPaused) {
      const latestMsg = messages[messages.length - 1];
      setAnnouncement(latestMsg.message);
    }
  }, [messages, isPaused]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const toggleMinimized = useCallback(() => {
    setIsMinimized(prev => {
      const newValue = !prev;
      localStorage.setItem('ticker-minimized', String(newValue));
      return newValue;
    });
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
      top: isMinimized ? `${position.y}px` : 'auto',
      left: isMinimized ? `${position.x}px` : '0',
      bottom: isMinimized ? 'auto' : '0',
      width: isMinimized ? 'auto' : '100%',
      zIndex: 900,
      padding: isMinimized ? '0' : (isMobile ? '0' : '10px'),
      pointerEvents: 'none',
      transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    glassPanel: {
      pointerEvents: 'auto',
      background: isMinimized ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: isDragging ? 'rgba(99, 102, 241, 0.4)' : 'rgba(0, 0, 0, 0.08)',
      borderRadius: isMinimized ? '24px' : (isMobile ? '0' : '99px'),
      boxShadow: isMinimized 
        ? (isDragging ? '0 20px 60px rgba(99, 102, 241, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.2)' : '0 8px 32px rgba(0,0,0,0.12)')
        : '0 -2px 20px rgba(0,0,0,0.08)',
      display: 'flex',
      alignItems: 'center',
      height: isMinimized ? 'auto' : (isMobile ? '44px' : '48px'),
      overflow: 'hidden',
      maxWidth: isMinimized ? 'none' : '1200px',
      margin: isMinimized ? '0' : '0 auto',
      transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      transition: isDragging ? 'transform 0.1s ease' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: isMinimized ? (isDragging ? 'grabbing' : 'grab') : 'default',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      // FIX: This CSS property is crucial. It tells the browser 
      // "don't scroll the page when touching this element".
      touchAction: isMinimized ? 'none' : 'auto', 
    },
    minimizedBadge: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 16px',
      background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
      borderRadius: '24px',
      margin: '0',
    },
    dragHandle: {
      color: '#dc2626',
      opacity: isDragging ? 1 : (isHovering ? 0.8 : 0.5),
      transition: 'opacity 0.2s ease',
      flexShrink: 0,
      cursor: isDragging ? 'grabbing' : 'grab',
      marginRight: '4px',
      transform: isDragging ? 'scale(1.1)' : 'scale(1)',
    },
    liveSection: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      color: '#dc2626',
      fontSize: '0.75rem',
      fontWeight: 800,
      letterSpacing: '0.05em',
    },
    liveDot: {
      width: '8px',
      height: '8px',
      backgroundColor: '#ef4444',
      borderRadius: '50%',
      animation: isDragging ? 'none' : 'livePulse 2s ease-in-out infinite',
      flexShrink: 0,
    },
    divider: {
      width: '1px',
      height: '16px',
      background: 'rgba(220, 38, 38, 0.3)',
      flexShrink: 0,
    },
    viewerSection: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      color: '#dc2626',
      fontSize: '0.75rem',
      fontWeight: 700,
    },
    viewerNumber: {
      fontVariantNumeric: 'tabular-nums',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      minWidth: '35px',
      textAlign: 'left',
    },
    expandIcon: {
      color: '#dc2626',
      opacity: isHovering ? 1 : 0.5,
      transition: 'opacity 0.2s ease',
      flexShrink: 0,
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
    liveBadgeWithCount: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
      color: '#dc2626',
      padding: isMobile ? '6px 10px' : '6px 12px',
      borderRadius: '20px',
      fontSize: isMobile ? '0.7rem' : '0.75rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      userSelect: 'none',
      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)',
      flexShrink: 0,
    },
    controls: {
      display: 'flex',
      gap: '4px',
      alignItems: 'center',
    },
    iconBtn: {
      background: 'transparent',
      borderWidth: '0',
      borderStyle: 'none',
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#64748b',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      outline: 'none',
      flexShrink: 0,
    },
    minimizeBtn: {
      background: 'rgba(239, 68, 68, 0.1)',
      borderWidth: '0',
      borderStyle: 'none',
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ef4444',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      outline: 'none',
      flexShrink: 0,
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
      willChange: isPaused ? 'auto' : 'transform',
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
    srOnly: {
      position: 'absolute',
      left: '-10000px',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
    },
  };

  // Inject animations
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

  const excludedPaths = ['/signin', '/signup', '/login', '/forgot-password', '/reset-password', '/profile', '/terms', '/privacy' , '/admin'];
  const shouldHideTicker = excludedPaths.some(path => 
    location.pathname.toLowerCase().includes(path.toLowerCase())
  );

  if (shouldHideTicker) {
    return null;
  }

  // Minimized view with drag
  if (isMinimized) {
    return (
      <div style={styles.wrapper}>
        <div 
          ref={dragRef}
          style={styles.glassPanel}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          role="button"
          tabIndex={0}
          aria-label="Drag to reposition or double-click to expand live ticker"
          onDoubleClick={toggleMinimized}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleMinimized();
            }
          }}
        >
          <div style={styles.minimizedBadge}>
            <span style={styles.dragHandle}>
              <GripVertical size={16} />
            </span>

            <div style={styles.liveSection}>
              <span style={styles.liveDot} aria-hidden="true"></span>
              <span>LIVE</span>
            </div>
            
            <span style={styles.divider}></span>
            
            <div style={styles.viewerSection}>
              <Eye size={14} aria-hidden="true" />
              <span style={styles.viewerNumber}>{viewerCount.toLocaleString()}</span>
            </div>

            <span 
              style={styles.expandIcon}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDragging) {
                  toggleMinimized();
                }
              }}
              role="button"
              aria-label="Expand ticker"
            >
              <ChevronUp size={16} />
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div style={styles.wrapper}>
      <div style={styles.glassPanel}>
        
        {/* Screen reader announcement region */}
        <div 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
          style={styles.srOnly}
        >
          {announcement}
        </div>
        
        <div style={styles.sidebar}>
          <div 
            style={styles.liveBadgeWithCount}
            title={`${viewerCount} people viewing now`}
          >
            <div style={styles.liveSection}>
              <span style={styles.liveDot} aria-hidden="true"></span>
              <span style={{ fontWeight: 800, letterSpacing: '0.05em' }}>LIVE</span>
            </div>
            
            <span style={styles.divider}></span>
            
            <div style={styles.viewerSection}>
              <Eye size={isMobile ? 12 : 14} aria-hidden="true" />
              <span style={styles.viewerNumber}>{viewerCount.toLocaleString()}</span>
            </div>
          </div>
          
          <div style={styles.controls}>
            {!isMobile && (
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
                {isPaused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            )}
            
            <button 
              style={styles.minimizeBtn}
              onClick={toggleMinimized}
              aria-label="Minimize ticker"
              type="button"
              title="Minimize ticker"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        <div style={styles.trackContainer} role="region" aria-label="Live activity feed">
          <div 
            style={{
              ...styles.track,
              animation: isPaused ? 'none' : `scrollTicker ${ANIMATION_DURATION}s linear infinite`,
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