import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/posts/', '/privacy', '/feedback', '/ranking', '/en/ranking', '/zh/ranking'],
        disallow: ['/admin', '/my', '/login', '/signup', '/auth/', '/api/'],
      },
    ],
    sitemap: 'https://now.nemoneai.com/sitemap.xml',
  }
}
