import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  try {
    const { count, error } = await supabase!
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json(
        { status: 'error', error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      user_count: count,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { status: 'error', error: String(e) },
      { status: 500 },
    );
  }
}
