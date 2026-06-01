import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/posts/', '/privacy', '/feedback'],
        disallow: ['/admin', '/my', '/login', '/signup', '/auth/', '/api/'],
      },
    ],
    sitemap: 'https://now.nemoneai.com/sitemap.xml',
  }
}
