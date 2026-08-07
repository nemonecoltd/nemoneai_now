import { Metadata } from 'next';
import { generateRegionStaticParams, generateRegionMetadata, RegionPopularHubPage, revalidate as _revalidate } from '@/lib/regionPopularHub';

export const revalidate = _revalidate;
export const generateStaticParams = generateRegionStaticParams;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return generateRegionMetadata(slug, 'zh');
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return RegionPopularHubPage({ slug, lang: 'zh' });
}
