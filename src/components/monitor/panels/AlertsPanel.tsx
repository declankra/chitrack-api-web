// src/components/monitor/panels/AlertsPanel.tsx
'use client';

import { useState } from 'react';
import { AlertTriangle, Bell, Info, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from 'lucide-react';
import type { CTAAlert, AlertSeverity, AlertCategory } from '@/lib/types/monitor';

interface AlertsPanelProps {
  data: {
    alerts: CTAAlert[];
    summary: {
      total: number;
      byType: Partial<Record<AlertCategory, number>>;
      bySeverity: Partial<Record<AlertSeverity, number>>;
    };
    lastUpdated: string;
  } | null;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
}

// Get alert icon based on severity
function getAlertIcon(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-critical))]" />;
    case 'major':
      return <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-degraded))]" />;
    case 'minor':
      return <Bell className="h-4 w-4 text-[hsl(var(--monitor-accent-cyan))]" />;
    default:
      return <Info className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />;
  }
}

// Get severity class for styling
function getSeverityClass(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical':
      return 'severity-critical';
    case 'major':
      return 'severity-major';
    case 'minor':
      return 'severity-minor';
    default:
      return 'severity-info';
  }
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function AlertCard({ alert }: { alert: CTAAlert }) {
  const [expanded, setExpanded] = useState(false);

  // Get affected routes for display
  const affectedRoutes = alert.affectedServices
    .filter((s) => s.type === 'train')
    .map((s) => s.routeName)
    .slice(0, 3);

  const affectedBuses = alert.affectedServices
    .filter((s) => s.type === 'bus')
    .map((s) => s.routeId)
    .slice(0, 3);

  return (
    <div className={`monitor-alert-card ${getSeverityClass(alert.severity)}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-start gap-2">
          {getAlertIcon(alert.severity)}
          <div className="flex-1 min-w-0">
            {/* Affected services */}
            <div className="flex items-center gap-1 flex-wrap mb-1">
              {affectedRoutes.map((route) => (
                <span
                  key={route}
                  className="text-[10px] font-medium text-[hsl(var(--monitor-text-primary))] bg-[hsl(var(--monitor-bg-hover))] px-1.5 py-0.5 rounded"
                >
                  {route}
                </span>
              ))}
              {affectedBuses.map((bus) => (
                <span
                  key={bus}
                  className="text-[10px] font-medium text-[hsl(var(--monitor-text-secondary))] bg-[hsl(var(--monitor-bg-hover))] px-1.5 py-0.5 rounded"
                >
                  Bus #{bus}
                </span>
              ))}
            </div>

            {/* Headline */}
            <p className="text-xs font-medium text-[hsl(var(--monitor-text-primary))] line-clamp-2">
              {alert.headline}
            </p>

            {/* Short description */}
            <p className="text-[10px] text-[hsl(var(--monitor-text-secondary))] mt-1 line-clamp-2">
              {alert.shortDescription}
            </p>

            {/* Metadata */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-[hsl(var(--monitor-text-muted))]">
                {formatRelativeTime(alert.updatedAt)}
              </span>
              {alert.majorAlert && (
                <span className="text-[10px] text-[hsl(var(--status-critical))] font-medium">
                  MAJOR
                </span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0">
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[hsl(var(--monitor-text-muted))]" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[hsl(var(--monitor-border))]">
          <p className="text-[11px] text-[hsl(var(--monitor-text-secondary))] whitespace-pre-wrap">
            {alert.fullDescription}
          </p>

          {alert.url && (
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[10px] text-[hsl(var(--monitor-accent-cyan))] hover:underline"
            >
              More info <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function AlertsPanel({ data, isLoading, error, onRefresh }: AlertsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'train' | 'bus'>('all');

  if (isLoading) {
    return (
      <div className="monitor-panel h-full">
        <div className="monitor-panel-header">
          <span className="monitor-panel-title">SERVICE ALERTS</span>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-[hsl(var(--monitor-bg-tertiary))] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="monitor-panel h-full">
        <div className="monitor-panel-header">
          <span className="monitor-panel-title">SERVICE ALERTS</span>
        </div>
        <div className="p-4 text-center">
          <AlertTriangle className="h-8 w-8 text-[hsl(var(--monitor-text-muted))] mx-auto mb-2" />
          <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
            Failed to load alerts
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-2 text-xs text-[hsl(var(--monitor-accent-cyan))] hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const alerts = data?.alerts || [];
  const total = data?.summary.total || 0;

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'all') return true;
    if (filter === 'critical') return alert.severity === 'critical' || alert.severity === 'major';
    if (filter === 'train') return alert.affectedServices.some((s) => s.type === 'train');
    if (filter === 'bus') return alert.affectedServices.some((s) => s.type === 'bus');
    return true;
  });

  return (
    <div className="monitor-panel h-full flex flex-col">
      <div className="monitor-panel-header">
        <span className="monitor-panel-title">SERVICE ALERTS</span>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 hover:bg-[hsl(var(--monitor-bg-hover))] rounded"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[hsl(var(--monitor-text-muted))]" />
            </button>
          )}
          <span className="text-xs font-medium text-[hsl(var(--monitor-text-primary))]">
            {total}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 flex gap-1 border-b border-[hsl(var(--monitor-border))]">
        {(['all', 'critical', 'train', 'bus'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              filter === f
                ? 'bg-[hsl(var(--monitor-accent-cyan)/0.2)] text-[hsl(var(--monitor-accent-cyan))]'
                : 'text-[hsl(var(--monitor-text-muted))] hover:bg-[hsl(var(--monitor-bg-hover))]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'critical' ? 'Critical' : f === 'train' ? 'Train' : 'Bus'}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-8 w-8 text-[hsl(var(--monitor-text-muted))] mx-auto mb-2" />
            <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
              {filter === 'all' ? 'No active alerts' : `No ${filter} alerts`}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))
        )}
      </div>

      {/* Footer */}
      {filteredAlerts.length > 0 && (
        <div className="px-4 py-2 border-t border-[hsl(var(--monitor-border))]">
          <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] text-center">
            Showing {filteredAlerts.length} of {total} alerts
          </p>
        </div>
      )}
    </div>
  );
}

export default AlertsPanel;
