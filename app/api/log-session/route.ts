export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// 服务端优先用 service role key；开发阶段回退到 publishable/anon key
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { anonId, sessionData } = body as {
      anonId: string;
      sessionData: {
        ingredients: unknown[];
        fatigueLevel: number;
        foodPreference: string;
        dishes: unknown[];
        durationMs: number;
      };
    };

    if (!anonId || !sessionData) {
      return NextResponse.json({ ok: false, error: 'Missing anonId or sessionData' }, { status: 400 });
    }

    const sb = createClient(supabaseUrl, supabaseKey);

    // 查找对应用户
    const { data: user } = await sb
      .from('users')
      .select('id')
      .eq('anon_id', anonId)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // 写入推荐会话
    const { data: session, error } = await sb
      .from('recipe_sessions')
      .insert({
        user_id: user.id,
        input_ingredients: sessionData.ingredients,
        fatigue_level: sessionData.fatigueLevel,
        food_preference: sessionData.foodPreference,
        recommended_dishes: sessionData.dishes,
        total_duration_ms: sessionData.durationMs,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[log-session] Insert error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, session_id: (session as { id: string }).id });
  } catch (e) {
    console.error('[log-session] Unexpected error:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
