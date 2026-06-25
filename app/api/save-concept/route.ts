import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

type SaveConceptRequestBody = {
  subject: string;
  concept: string;
  masteryLevel: string;
  overviewGist: string;
  deepDiveGist: string[];
  strongAreas: string[];
  weakAreas: string[];
  nextSteps: string[];
  notes: string;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<SaveConceptRequestBody>;

  if (
    typeof body.subject !== 'string' ||
    typeof body.concept !== 'string' ||
    typeof body.masteryLevel !== 'string' ||
    typeof body.overviewGist !== 'string' ||
    !isStringArray(body.deepDiveGist) ||
    !isStringArray(body.strongAreas) ||
    !isStringArray(body.weakAreas) ||
    !isStringArray(body.nextSteps) ||
    typeof body.notes !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('concepts')
    .upsert(
      {
        subject: body.subject.trim(),
        concept: body.concept.trim(),
        mastery_level: body.masteryLevel.trim(),
        overview_gist: body.overviewGist.trim(),
        deep_dive_gist: body.deepDiveGist,
        strong_areas: body.strongAreas,
        weak_areas: body.weakAreas,
        next_steps: body.nextSteps,
        notes: body.notes.trim(),
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'subject,concept' }
    );

  if (error) {
    return NextResponse.json({ error: 'Supabase upsert failed', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
