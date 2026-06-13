import { Metadata } from 'next';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const res = await fetch(`${BACKEND}/places/${params.id}`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const place = await res.json();
      if (place) {
        const title = place.title_en ? `${place.title} · ${place.title_en}` : place.title;
        const description = (place.content || '').slice(0, 160);
        return {
          title,
          description,
          alternates: {
            canonical: `https://now.nemoneai.com/posts/${params.id}`,
          },
          openGraph: {
            title,
            description,
            url: `https://now.nemoneai.com/posts/${params.id}`,
            images: place.image_url ? [{ url: place.image_url, alt: place.title }] : ['/og-image.png'],
            type: 'article',
            locale: 'ko_KR',
          },
          twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: place.image_url ? [place.image_url] : ['/og-image.png'],
          },
        };
      }
    }
  } catch {}

  return {
    title: `장소 #${params.id}`,
    description: '지금 바로 이 시간 성수·홍대 팝업, 서울 공연·전시, 제주 문화행사를 확인해보세요.',
    alternates: {
      canonical: `https://now.nemoneai.com/posts/${params.id}`,
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
