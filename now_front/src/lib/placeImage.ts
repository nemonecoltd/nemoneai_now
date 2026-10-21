// 대표 이미지가 없는 장소의 목록 썸네일 대체 이미지.
// 상세 페이지(PlaceDetailClient)가 쓰는 시드(`seongsu-${id}`)와 같게 맞춰, 같은 장소는 목록과 상세에서 같은 사진이 나온다.
export function placeImage(id: number, imageUrl: string | null | undefined, w: number, h: number): string {
  return imageUrl || `https://picsum.photos/seed/seongsu-${id}/${w}/${h}`;
}
