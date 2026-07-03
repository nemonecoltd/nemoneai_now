import { Metadata } from 'next';
import PlaceDetailClient, { Place } from './PlaceDetailClient';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

async function getPlace(id: string): Promise<Place | null> {
  try {
    const res = await fetch(`${BACKEND}/places/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getSuggestions(excludeId: string, region: string): Promise<Place[]> {
  try {
    const res = await fetch(`${BACKEND}/places?region=${encodeURIComponent(region)}&limit=30`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const all: Place[] = await res.json();
    const pool = all.filter((p) => p.id !== Number(excludeId) && p.image_url);
    return pool.sort(() => Math.random() - 0.5).slice(0, 15);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlace(id);
  if (!place) return {};

  const description = place.content
    ?.replace(/\|/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .substring(0, 160);

  return {
    title: `${place.title} | Now Here`,
    description,
    openGraph: {
      title: place.title,
      description,
      images: place.image_url ? [{ url: place.image_url }] : [],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: place.title,
      description,
      images: place.image_url ? [place.image_url] : [],
    },
  };
}

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang = 'ko' } = await searchParams;

  const place = await getPlace(id);
  const suggestions = place ? await getSuggestions(id, place.region || '성수') : [];

  return <PlaceDetailClient place={place} lang={lang} suggestions={suggestions} />;
}
