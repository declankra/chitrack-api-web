// src/components/monitor/panels/SocialFeedPanel.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MessageCircle,
  Heart,
  Repeat2,
  ExternalLink,
  Filter,
  RefreshCw,
  Smile,
  Meh,
  Frown,
  CheckCircle,
  Rss,
} from 'lucide-react';
import type { RouteColor } from '@/lib/types/monitor';

// Types
interface SocialPost {
  id: string;
  platform: 'rss' | 'twitter' | 'reddit';
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    verified: boolean;
    isOfficial: boolean;
  };
  content: string;
  timestamp: string;
  url: string;
  engagement: {
    likes: number;
    reposts: number;
    replies: number;
  };
  sentiment: 'positive' | 'negative' | 'neutral';
  mentionedRoutes: string[];
  mentionedStations: string[];
  hashtags: string[];
  isRetweet: boolean;
}

interface SocialFeedData {
  posts: SocialPost[];
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  trending: Array<{ hashtag: string; count: number }>;
  volume: {
    current: number;
    hourlyAverage: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  lastUpdated: string;
}

interface SocialFeedPanelProps {
  onRefresh?: () => void;
}

// Line color mapping
const LINE_COLORS: Record<RouteColor, string> = {
  Red: 'bg-red-600',
  Blue: 'bg-blue-500',
  Brn: 'bg-amber-800',
  G: 'bg-green-600',
  Org: 'bg-orange-500',
  P: 'bg-purple-600',
  Pink: 'bg-pink-400',
  Y: 'bg-yellow-400',
};

// Platform icons
function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case 'twitter':
      return <span className="text-[10px]">𝕏</span>;
    case 'reddit':
      return <span className="text-[10px]">r/</span>;
    case 'rss':
      return <Rss className="h-3 w-3" />;
    default:
      return null;
  }
}

// Format relative time
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

// Social post card
function PostCard({ post }: { post: SocialPost }) {
  const sentimentColors = {
    positive: 'border-l-[hsl(var(--status-nominal))]',
    negative: 'border-l-[hsl(var(--status-degraded))]',
    neutral: 'border-l-[hsl(var(--monitor-border))]',
  };

  return (
    <div
      className={`
        p-3 bg-[hsl(var(--monitor-bg-tertiary))] rounded
        border-l-2 ${sentimentColors[post.sentiment]}
      `}
    >
      {/* Author header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-[hsl(var(--monitor-bg-hover))] flex items-center justify-center text-[hsl(var(--monitor-text-muted))]">
            <PlatformIcon platform={post.platform} />
          </div>
          <span className="text-xs font-medium text-[hsl(var(--monitor-text-primary))]">
            {post.author.displayName}
          </span>
          {post.author.verified && (
            <CheckCircle className="h-3 w-3 text-[hsl(var(--monitor-accent-cyan))]" />
          )}
          {post.author.isOfficial && (
            <span className="text-[10px] px-1 py-0.5 bg-[hsl(var(--monitor-accent-cyan)/0.2)] text-[hsl(var(--monitor-accent-cyan))] rounded">
              Official
            </span>
          )}
        </div>
        <span className="text-[10px] text-[hsl(var(--monitor-text-muted))] ml-auto">
          {formatRelativeTime(post.timestamp)}
        </span>
      </div>

      {/* Content */}
      <p className="text-xs text-[hsl(var(--monitor-text-secondary))] mb-2 line-clamp-3">
        {post.content}
      </p>

      {/* Mentioned routes */}
      {post.mentionedRoutes.length > 0 && (
        <div className="flex items-center gap-1 mb-2">
          {post.mentionedRoutes.map((route) => (
            <span
              key={route}
              className={`w-2.5 h-2.5 rounded-full ${LINE_COLORS[route as RouteColor] || 'bg-gray-500'}`}
            />
          ))}
        </div>
      )}

      {/* Footer with engagement and link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[hsl(var(--monitor-text-muted))]">
          {post.engagement.likes > 0 && (
            <span className="flex items-center gap-1 text-[10px]">
              <Heart className="h-3 w-3" />
              {post.engagement.likes}
            </span>
          )}
          {post.engagement.reposts > 0 && (
            <span className="flex items-center gap-1 text-[10px]">
              <Repeat2 className="h-3 w-3" />
              {post.engagement.reposts}
            </span>
          )}
          {post.engagement.replies > 0 && (
            <span className="flex items-center gap-1 text-[10px]">
              <MessageCircle className="h-3 w-3" />
              {post.engagement.replies}
            </span>
          )}
        </div>
        {post.url && post.url !== '#' && (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[hsl(var(--monitor-accent-cyan))] hover:underline flex items-center gap-0.5"
          >
            View <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// Sentiment bar component
function SentimentBar({ sentiment }: { sentiment: SocialFeedData['sentiment'] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--monitor-bg-tertiary))] overflow-hidden flex">
        <div
          className="h-full bg-[hsl(var(--status-nominal))]"
          style={{ width: `${sentiment.positive}%` }}
        />
        <div
          className="h-full bg-[hsl(var(--monitor-text-muted))]"
          style={{ width: `${sentiment.neutral}%` }}
        />
        <div
          className="h-full bg-[hsl(var(--status-degraded))]"
          style={{ width: `${sentiment.negative}%` }}
        />
      </div>
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="flex items-center gap-0.5 text-[hsl(var(--status-nominal))]">
          <Smile className="h-3 w-3" />
          {sentiment.positive}%
        </span>
        <span className="flex items-center gap-0.5 text-[hsl(var(--monitor-text-muted))]">
          <Meh className="h-3 w-3" />
          {sentiment.neutral}%
        </span>
        <span className="flex items-center gap-0.5 text-[hsl(var(--status-degraded))]">
          <Frown className="h-3 w-3" />
          {sentiment.negative}%
        </span>
      </div>
    </div>
  );
}

// Hook to fetch social feed
function useSocialFeed(officialOnly: boolean) {
  return useQuery<SocialFeedData>({
    queryKey: ['monitor', 'social', officialOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (officialOnly) params.set('officialOnly', 'true');
      const response = await fetch(`/api/monitor/social?${params}`);
      if (!response.ok) throw new Error('Failed to fetch social feed');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}

export function SocialFeedPanel({ onRefresh }: SocialFeedPanelProps) {
  const [officialOnly, setOfficialOnly] = useState(false);
  const { data, isLoading, error, refetch } = useSocialFeed(officialOnly);

  if (isLoading) {
    return (
      <div className="monitor-panel h-full">
        <div className="monitor-panel-header">
          <span className="monitor-panel-title">SOCIAL FEED</span>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-[hsl(var(--monitor-bg-tertiary))] rounded" />
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
          <span className="monitor-panel-title">SOCIAL FEED</span>
        </div>
        <div className="p-4 text-center">
          <MessageCircle className="h-8 w-8 text-[hsl(var(--monitor-text-muted))] mx-auto mb-2" />
          <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
            Failed to load social feed
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-xs text-[hsl(var(--monitor-accent-cyan))] hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const posts = data?.posts || [];
  const sentiment = data?.sentiment || { positive: 33, negative: 33, neutral: 34 };
  const trending = data?.trending || [];

  return (
    <div className="monitor-panel h-full flex flex-col">
      {/* Header */}
      <div className="monitor-panel-header">
        <span className="monitor-panel-title">SOCIAL FEED</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-1 hover:bg-[hsl(var(--monitor-bg-hover))] rounded"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[hsl(var(--monitor-text-muted))]" />
          </button>
          <span className="text-xs text-[hsl(var(--status-nominal))]">Live</span>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 py-2 border-b border-[hsl(var(--monitor-border))]">
        <button
          onClick={() => setOfficialOnly(!officialOnly)}
          className={`
            flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors
            ${officialOnly
              ? 'bg-[hsl(var(--monitor-accent-cyan)/0.2)] text-[hsl(var(--monitor-accent-cyan))]'
              : 'text-[hsl(var(--monitor-text-muted))] hover:bg-[hsl(var(--monitor-bg-hover))]'
            }
          `}
        >
          <Filter className="h-3 w-3" />
          {officialOnly ? 'Official Only' : 'All Posts'}
        </button>
      </div>

      {/* Sentiment overview */}
      <div className="px-4 py-2 border-b border-[hsl(var(--monitor-border))]">
        <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] mb-1.5 uppercase">
          Sentiment
        </p>
        <SentimentBar sentiment={sentiment} />
      </div>

      {/* Trending topics */}
      {trending.length > 0 && (
        <div className="px-4 py-2 border-b border-[hsl(var(--monitor-border))]">
          <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] mb-1.5 uppercase">
            Trending
          </p>
          <div className="flex flex-wrap gap-1">
            {trending.slice(0, 5).map((item) => (
              <span
                key={item.hashtag}
                className="text-[10px] px-1.5 py-0.5 bg-[hsl(var(--monitor-bg-tertiary))] text-[hsl(var(--monitor-text-secondary))] rounded"
              >
                #{item.hashtag} ({item.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Posts list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {posts.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-8 w-8 text-[hsl(var(--monitor-text-muted))] mx-auto mb-2" />
            <p className="text-xs text-[hsl(var(--monitor-text-muted))]">
              No posts available
            </p>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>

      {/* Footer */}
      {posts.length > 0 && (
        <div className="px-4 py-2 border-t border-[hsl(var(--monitor-border))]">
          <p className="text-[10px] text-[hsl(var(--monitor-text-muted))] text-center">
            Showing {posts.length} posts • Data from CTA News
          </p>
        </div>
      )}
    </div>
  );
}

export default SocialFeedPanel;
