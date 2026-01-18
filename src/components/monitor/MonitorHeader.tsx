// src/components/monitor/MonitorHeader.tsx
'use client';

import { useState, useEffect } from 'react';
import { Menu, Settings, RefreshCw, Home, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useMonitor } from '@/lib/providers/MonitorProvider';
import type { SystemHealthStatus } from '@/lib/types/monitor';

interface MonitorHeaderProps {
  systemStatus: SystemHealthStatus;
  lastUpdate: Date | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onMenuClick?: () => void;
  onSettingsClick?: () => void;
}

export function MonitorHeader({
  systemStatus,
  lastUpdate,
  isRefreshing = false,
  onRefresh,
  onMenuClick,
  onSettingsClick,
}: MonitorHeaderProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const { state, toggleSidebar } = useMonitor();

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return '--:--:--';
    return formatTime(date);
  };

  const statusConfig = {
    nominal: {
      label: 'NOMINAL',
      className: 'monitor-status-nominal',
      textClass: 'text-[hsl(var(--status-nominal))]',
    },
    degraded: {
      label: 'DEGRADED',
      className: 'monitor-status-degraded',
      textClass: 'text-[hsl(var(--status-degraded))]',
    },
    critical: {
      label: 'CRITICAL',
      className: 'monitor-status-critical',
      textClass: 'text-[hsl(var(--status-critical))]',
    },
  };

  const status = statusConfig[systemStatus];

  return (
    <header className="monitor-header h-14 bg-[hsl(var(--monitor-bg-secondary))] border-b border-[hsl(var(--monitor-border))] flex items-center justify-between px-4 sticky top-0 z-50">
      {/* Left section - Logo and back */}
      <div className="flex items-center gap-4">
        <Link
          href="/home"
          className="flex items-center gap-2 text-[hsl(var(--monitor-text-secondary))] hover:text-[hsl(var(--monitor-text-primary))] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <Home className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-2">
          {/* Logo glow effect */}
          <div className="relative">
            <div className="absolute inset-0 bg-[hsl(var(--monitor-accent-cyan))] blur-lg opacity-30" />
            <span className="relative monitor-mono text-lg font-bold text-[hsl(var(--monitor-accent-cyan))]">
              ◈
            </span>
          </div>
          <div className="flex flex-col">
            <span className="monitor-mono text-sm font-bold text-[hsl(var(--monitor-text-primary))] tracking-wider">
              CHITRACK
            </span>
            <span className="monitor-mono text-[10px] text-[hsl(var(--monitor-text-muted))] tracking-widest">
              MONITOR
            </span>
          </div>
        </div>
      </div>

      {/* Center section - Status and time */}
      <div className="flex items-center gap-6">
        {/* System Status */}
        <div className="flex items-center gap-2">
          <span className="monitor-mono text-xs text-[hsl(var(--monitor-text-muted))] uppercase">
            System:
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`monitor-status-dot ${status.className}`} />
            <span className={`monitor-mono text-xs font-medium ${status.textClass}`}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Current Time */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="monitor-mono text-xs text-[hsl(var(--monitor-text-muted))]">
            TIME
          </span>
          <span className="monitor-mono text-sm text-[hsl(var(--monitor-text-primary))]">
            {formatTime(currentTime)}
          </span>
        </div>

        {/* Last Update */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-[hsl(var(--monitor-text-secondary))] hover:text-[hsl(var(--monitor-accent-cyan))] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="monitor-mono text-xs">
              {formatLastUpdate(lastUpdate)}
            </span>
          </button>
        </div>
      </div>

      {/* Right section - Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSettingsClick}
          className="p-2 text-[hsl(var(--monitor-text-secondary))] hover:text-[hsl(var(--monitor-text-primary))] hover:bg-[hsl(var(--monitor-bg-hover))] rounded-md transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onMenuClick || toggleSidebar}
          className="p-2 text-[hsl(var(--monitor-text-secondary))] hover:text-[hsl(var(--monitor-text-primary))] hover:bg-[hsl(var(--monitor-bg-hover))] rounded-md transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

export default MonitorHeader;
