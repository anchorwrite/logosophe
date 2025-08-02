import { NextResponse } from 'next/server';


export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ message: 'Status endpoint not implemented' }, { status: 501 });
} 