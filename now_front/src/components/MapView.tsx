"use client";

import { useEffect, useRef, useState } from 'react';
import { Calendar, Navigation, X, MapPin, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Place {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  image_url?: string;
  date_range?: string;
  content?: string;
  region?: string;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

let isApiLoading = false;

const REGIONS = {
  '성수': { lat: 37.5445, lng: 127.0560, title: '성수 팝업 맵' },
  '홍대': { lat: 37.5575, lng: 126.9245, title: '홍대 팝업 맵' },
  '용산': { lat: 37.5344, lng: 126.9947, title: '용산 팝업 맵' }  // 이태원역 기준(한남동 인접) — 수집 데이터가 용산구 전역에 퍼져있어 평균 좌표 대신 핵심 상권으로 고정
};

export default function MapView({ places = [], region = '성수', lang = 'ko' }: { places?: Place[], region?: string, lang?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (window.google) {
      setMapLoaded(true);
      return;
    }
    if (isApiLoading) return;
    isApiLoading = true;

    window.initMap = () => setMapLoaded(true);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&v=weekly`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (mapLoaded && mapRef.current && window.google) {
      const currentRegion = REGIONS[region as keyof typeof REGIONS] || REGIONS['성수'];

      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: currentRegion.lat, lng: currentRegion.lng },
        zoom: 15,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        styles: [
          { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
          { "featureType": "transit", "stylers": [{ "visibility": "simplified" }] }
        ]
      });

      setMapInstance(map);

      places.forEach((place) => {
        const position = (place.latitude && place.longitude)
          ? { lat: Number(place.latitude), lng: Number(place.longitude) }
          : {
              lat: currentRegion.lat + (Math.random() - 0.5) * 0.006,
              lng: currentRegion.lng + (Math.random() - 0.5) * 0.006
            };

        const marker = new window.google.maps.Marker({
          position,
          map,
          title: lang === 'en' ? (place.title_en || place.title) : lang === 'zh' ? (place.title_zh || place.title) : place.title,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: region === '홍대' ? '#8b5cf6' : region === '용산' ? '#eab308' : '#10b981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 7,
          }
        });

        marker.addListener('click', () => {
          setSelectedPlace(place);
        });
      });
    }
  }, [mapLoaded, places, region, lang]);

  const handleMyLocation = () => {
    if (!mapInstance) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
          mapInstance.panTo(pos);
          mapInstance.setZoom(17);
          new window.google.maps.Marker({
            position: pos,
            map: mapInstance,
            title: lang === 'en' ? "My Location" : lang === 'zh' ? "我的位置" : "내 위치",
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8,
            }
          });
        },
        () => alert(lang === 'en' ? "Unable to retrieve your location." : lang === 'zh' ? "无法获取您的位置。" : "현재 위치를 가져올 수 없습니다.")
      );
    } else {
      alert(lang === 'en' ? "Geolocation is not supported by your browser." : lang === 'zh' ? "您的浏览器不支持地理定位。" : "브라우저가 위치 정보를 지원하지 않습니다.");
    }
  };

  return (
    <div className="w-full h-[calc(100vh-180px)] bg-zinc-50 relative overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />

      {/* Floating Info Card */}
      <div className="absolute top-6 left-6 right-6 z-50 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-xl p-4 rounded-3xl border border-white/40 shadow-2xl flex items-center gap-4 pointer-events-auto">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-inner flex-shrink-0",
            region === '홍대' ? "bg-purple-500" : region === '용산' ? "bg-yellow-500" : "bg-emerald-500"
          )}>
            <Calendar size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-zinc-900 tracking-tight">
              {lang === 'en'
                ? `${region === '성수' ? 'Seongsu' : region === '용산' ? 'Yongsan' : 'Hongdae'} Map`
                : lang === 'zh'
                  ? `${region === '성수' ? '圣水洞' : region === '용산' ? '龙山' : '弘大'}地图`
                  : (REGIONS[region as keyof typeof REGIONS]?.title || '지금 여기 팝업 맵')}
              <span className={cn(
                "ml-2 text-xs font-bold",
                region === '홍대' ? "text-purple-400" : region === '용산' ? "text-yellow-500" : "text-emerald-400"
              )}>
                (지금 당장 {places.length}개)
              </span>
            </h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              {lang === 'en' ? 'Tap markers for details' : lang === 'zh' ? '点击标记查看详情' : '마커를 누르면 상세 정보를 확인합니다'}
            </p>
          </div>
        </div>
      </div>

      {/* 우측 컨트롤 버튼 그룹 */}
      <div className="absolute bottom-28 right-6 z-[60] flex flex-col gap-1 shadow-2xl rounded-2xl overflow-hidden border border-zinc-200">
        <button
          onClick={() => mapInstance?.setZoom((mapInstance.getZoom() ?? 15) + 1)}
          className="w-11 h-11 bg-white text-zinc-600 hover:text-emerald-500 hover:bg-zinc-50 transition-all active:scale-95 flex items-center justify-center text-xl font-bold border-b border-zinc-100"
        >+</button>
        <button
          onClick={() => mapInstance?.setZoom((mapInstance.getZoom() ?? 15) - 1)}
          className="w-11 h-11 bg-white text-zinc-600 hover:text-emerald-500 hover:bg-zinc-50 transition-all active:scale-95 flex items-center justify-center text-xl font-bold border-b border-zinc-100"
        >−</button>
        <button
          onClick={handleMyLocation}
          className="w-11 h-11 bg-white text-zinc-600 hover:text-emerald-500 hover:bg-zinc-50 transition-all active:scale-95 flex items-center justify-center"
          aria-label="My Location"
        >
          <Navigation size={18} />
        </button>
      </div>

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-zinc-400 animate-pulse">
              {lang === 'en' ? 'Syncing Map...' : lang === 'zh' ? '地图同步中...' : '지도를 연동 중입니다...'}
            </p>
          </div>
        </div>
      )}

      {/* 장소 바텀시트 */}
      {selectedPlace && (
        <>
          {/* 배경 딤 */}
          <div
            className="absolute inset-0 z-[70] bg-black/20"
            onClick={() => setSelectedPlace(null)}
          />
          {/* 시트 */}
          <div className="absolute bottom-0 left-0 right-0 z-[80] bg-white rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up">
            {/* 이미지 */}
            {selectedPlace.image_url && (
              <div className="relative h-40 overflow-hidden">
                <img
                  src={selectedPlace.image_url}
                  alt={selectedPlace.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
            )}

            <div className="p-5">
              {/* 닫기 버튼 */}
              <button
                onClick={() => setSelectedPlace(null)}
                className="absolute top-4 right-4 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow z-10"
              >
                <X size={16} className="text-zinc-600" />
              </button>

              <h3 className="text-base font-black text-zinc-900 leading-snug pr-8 mb-2">
                {lang === 'en' ? (selectedPlace.title_en || selectedPlace.title) : lang === 'zh' ? (selectedPlace.title_zh || selectedPlace.title) : selectedPlace.title}
              </h3>

              {selectedPlace.location && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <MapPin size={12} />
                  <span>{selectedPlace.location}</span>
                </div>
              )}

              {selectedPlace.date_range && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold mb-4">
                  <Calendar size={12} />
                  <span>{selectedPlace.date_range}</span>
                </div>
              )}

              <button
                onClick={() => router.push(`/posts/${selectedPlace.id}?region=${encodeURIComponent(region)}&lang=${lang}`)}
                className={cn(
                  "w-full py-3 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2",
                  region === '홍대' ? "bg-purple-500" : region === '용산' ? "bg-yellow-500" : "bg-emerald-500"
                )}
              >
                {lang === 'en' ? 'View Details' : lang === 'zh' ? '查看详情' : '자세히 보기'}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
