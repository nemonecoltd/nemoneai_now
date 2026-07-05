import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const path = request.nextUrl.searchParams.get('path');

  if (!secret || secret !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }

  if (!path) {
    return NextResponse.json({ message: 'Missing path' }, { status: 400 });
  }

  revalidatePath(path);
  revalidatePath('/');

  return NextResponse.json({ revalidated: true, path });
}
