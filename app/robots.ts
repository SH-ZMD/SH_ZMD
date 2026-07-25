import type { MetadataRoute } from 'next';
import { siteConfig } from '../siteConfig';

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/drafts', '/editor', '/settings', '/workbench'] }, sitemap: `${siteConfig.siteUrl}/sitemap.xml`, host: siteConfig.siteUrl };
}
