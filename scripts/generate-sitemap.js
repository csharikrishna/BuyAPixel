import fs from 'fs';
import path from 'path';

const SITE_URL = process.env.SITE_URL || 'https://buyaspot.in';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const routes = [
  '/',
  '/blog',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/marketplace',
  '/leaderboard',
  '/help',
  '/canvas',
  '/scan',
  '/seo-info',
];

const seedBlogSlugs = [
  'how-pixel-advertising-works',
  'best-low-cost-advertising-methods',
  'history-of-internet-advertising-walls',
  'promote-your-startup-cheaply',
  'creative-pixel-ad-examples',
];

async function getPublishedBlogSlugs() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return seedBlogSlugs;
  }

  try {
    const endpoint = `${SUPABASE_URL}/rest/v1/blog_posts?select=slug&status=eq.published`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      console.warn('Falling back to seed blog slugs because Supabase fetch failed:', response.status);
      return seedBlogSlugs;
    }

    const rows = await response.json();
    const slugs = rows
      .map((row) => row?.slug)
      .filter((slug) => typeof slug === 'string' && slug.length > 0);

    return Array.from(new Set([...seedBlogSlugs, ...slugs]));
  } catch (error) {
    console.warn('Falling back to seed blog slugs:', error);
    return seedBlogSlugs;
  }
}

function buildUrl(loc, changefreq = 'weekly', priority = '0.6') {
  return `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

const baseUrls = routes.map((r) => buildUrl(r === '/' ? '/' : r, 'weekly', r === '/' ? '1.0' : '0.6'));
const blogSlugs = await getPublishedBlogSlugs();
const blogUrls = blogSlugs.map((slug) => buildUrl(`/blog/${slug}`, 'monthly', '0.7'));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...baseUrls, ...blogUrls].join('\n')}\n</urlset>`;

const outPath = path.join(process.cwd(), 'public', 'sitemap.xml');

fs.writeFileSync(outPath, sitemap, 'utf8');
console.log('Sitemap written to', outPath, `with ${blogSlugs.length} blog URLs`);
