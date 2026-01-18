// src/app/api/monitor/social/route.ts
import { NextRequest, NextResponse } from 'next/server';

// CTA's official RSS feeds
const CTA_NEWS_FEED = 'https://www.transitchicago.com/rss/ctanews.xml';

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

// Route keywords for detection
const ROUTE_KEYWORDS: Record<string, string[]> = {
  Red: ['red line', 'redline', 'red-line'],
  Blue: ['blue line', 'blueline', 'blue-line', "o'hare", 'ohare'],
  Brn: ['brown line', 'brownline', 'brown-line'],
  G: ['green line', 'greenline', 'green-line'],
  Org: ['orange line', 'orangeline', 'orange-line', 'midway'],
  P: ['purple line', 'purpleline', 'purple-line', 'evanston'],
  Pink: ['pink line', 'pinkline', 'pink-line'],
  Y: ['yellow line', 'yellowline', 'yellow-line', 'skokie'],
};

// Common station keywords
const STATION_KEYWORDS = [
  'fullerton', 'belmont', 'clark', 'lake', 'state', 'jackson', 'chicago',
  'howard', 'addison', 'sox', 'comiskey', 'wrigley', 'loop', 'downtown',
  'ohare', "o'hare", 'midway', 'union station', 'millennium',
];

// Sentiment keywords
const SENTIMENT_KEYWORDS = {
  positive: ['great', 'good', 'excellent', 'fast', 'on time', 'smooth', 'improved', 'love', 'thanks'],
  negative: ['delay', 'delayed', 'slow', 'stuck', 'late', 'crowded', 'problem', 'issue', 'broken', 'worst', 'terrible'],
};

function detectRoutes(text: string): string[] {
  const lowerText = text.toLowerCase();
  const routes: string[] = [];

  for (const [route, keywords] of Object.entries(ROUTE_KEYWORDS)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      routes.push(route);
    }
  }

  return routes;
}

function detectStations(text: string): string[] {
  const lowerText = text.toLowerCase();
  return STATION_KEYWORDS.filter((station) => lowerText.includes(station));
}

function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lowerText = text.toLowerCase();

  const positiveCount = SENTIMENT_KEYWORDS.positive.filter((kw) => lowerText.includes(kw)).length;
  const negativeCount = SENTIMENT_KEYWORDS.negative.filter((kw) => lowerText.includes(kw)).length;

  if (negativeCount > positiveCount) return 'negative';
  if (positiveCount > negativeCount) return 'positive';
  return 'neutral';
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g);
  return matches || [];
}

async function fetchCTANews(): Promise<SocialPost[]> {
  try {
    const response = await fetch(CTA_NEWS_FEED, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error('Failed to fetch CTA news feed');
      return [];
    }

    const xmlText = await response.text();

    // Simple XML parsing for RSS items
    const items: SocialPost[] = [];
    const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);

    for (const match of itemMatches) {
      const itemXml = match[1];

      // Extract fields
      const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                    itemXml.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const description = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
                         itemXml.match(/<description>(.*?)<\/description>/)?.[1] || '';
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const guid = itemXml.match(/<guid.*?>(.*?)<\/guid>/)?.[1] || link;

      // Clean HTML from description
      const cleanDescription = description
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      const content = title + (cleanDescription ? `: ${cleanDescription}` : '');

      items.push({
        id: `cta-${Buffer.from(guid).toString('base64').slice(0, 16)}`,
        platform: 'rss',
        author: {
          id: 'cta-official',
          username: 'caborinc',
          displayName: 'CTA',
          verified: true,
          isOfficial: true,
        },
        content: content.slice(0, 500), // Limit length
        timestamp: new Date(pubDate || Date.now()).toISOString(),
        url: link,
        engagement: {
          likes: 0,
          reposts: 0,
          replies: 0,
        },
        sentiment: analyzeSentiment(content),
        mentionedRoutes: detectRoutes(content),
        mentionedStations: detectStations(content),
        hashtags: extractHashtags(content),
        isRetweet: false,
      });
    }

    return items.slice(0, 20); // Limit to 20 items
  } catch (error) {
    console.error('Error parsing CTA news feed:', error);
    return [];
  }
}

// Generate simulated community posts to supplement the official feed
// In production, this would come from Twitter/Reddit APIs
function generateCommunityPosts(): SocialPost[] {
  const templates = [
    { content: 'Red Line running smooth today! 🚇', sentiment: 'positive' as const, routes: ['Red'] },
    { content: 'Delays on the Blue Line near Clark/Lake. Been stuck for 10 mins.', sentiment: 'negative' as const, routes: ['Blue'] },
    { content: 'Just caught the last train from Howard. Made it just in time!', sentiment: 'positive' as const, routes: ['Red', 'P', 'Y'] },
    { content: 'Brown Line crowded as usual during rush hour', sentiment: 'neutral' as const, routes: ['Brn'] },
    { content: 'Green Line service restored after earlier delays', sentiment: 'positive' as const, routes: ['G'] },
    { content: 'Orange Line to Midway running on time', sentiment: 'positive' as const, routes: ['Org'] },
  ];

  // Only return a few random community posts
  const count = Math.floor(Math.random() * 3) + 1;
  const selected = templates.sort(() => Math.random() - 0.5).slice(0, count);

  return selected.map((template, index) => ({
    id: `community-${Date.now()}-${index}`,
    platform: 'twitter' as const,
    author: {
      id: `user-${index}`,
      username: `chicagoan${Math.floor(Math.random() * 1000)}`,
      displayName: 'Chicago Commuter',
      verified: false,
      isOfficial: false,
    },
    content: template.content,
    timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(), // Within last hour
    url: '#',
    engagement: {
      likes: Math.floor(Math.random() * 50),
      reposts: Math.floor(Math.random() * 10),
      replies: Math.floor(Math.random() * 5),
    },
    sentiment: template.sentiment,
    mentionedRoutes: template.routes,
    mentionedStations: [],
    hashtags: ['CTA', 'ChicagoTransit'],
    isRetweet: false,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const officialOnly = searchParams.get('officialOnly') === 'true';

    // Fetch CTA official news
    const ctaNews = await fetchCTANews();

    // Optionally add community posts
    const communityPosts = officialOnly ? [] : generateCommunityPosts();

    // Combine and sort by timestamp
    const allPosts = [...ctaNews, ...communityPosts]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    // Calculate sentiment distribution
    const sentimentCounts = allPosts.reduce(
      (acc, post) => {
        acc[post.sentiment]++;
        return acc;
      },
      { positive: 0, negative: 0, neutral: 0 }
    );

    const total = allPosts.length || 1;
    const sentiment = {
      positive: Math.round((sentimentCounts.positive / total) * 100),
      negative: Math.round((sentimentCounts.negative / total) * 100),
      neutral: Math.round((sentimentCounts.neutral / total) * 100),
    };

    // Extract trending topics
    const hashtagCounts = new Map<string, number>();
    allPosts.forEach((post) => {
      post.hashtags.forEach((tag) => {
        hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
      });
      post.mentionedRoutes.forEach((route) => {
        hashtagCounts.set(route, (hashtagCounts.get(route) || 0) + 1);
      });
    });

    const trending = Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hashtag, count]) => ({ hashtag, count }));

    return NextResponse.json({
      posts: allPosts,
      sentiment,
      trending,
      volume: {
        current: allPosts.length,
        hourlyAverage: 15, // Placeholder
        trend: 'stable' as const,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching social feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social feed' },
      { status: 500 }
    );
  }
}
