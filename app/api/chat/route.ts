import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { createClient } from '@/lib/supabase';
import { createAnthropic } from '@ai-sdk/anthropic';

type ChatRequestBody = {
  userMessage: string;
  subject: string;
  concept: string;
};

function getAnthropicProvider() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable.');
  }
  return createAnthropic({ apiKey });
}

type ConceptRow = {
  mastery_level?: string | null;
  weak_areas?: string | string[] | null;
  strong_areas?: string | string[] | null;
};

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function formatAreas(value: string | string[] | null | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value.join(', ') : value;
}

function buildSystemPrompt(
  subject: string,
  concept: string,
  row: ConceptRow | null,
): string {
  const weakAreas = formatAreas(row?.weak_areas);
  const strongAreas = formatAreas(row?.strong_areas);

  if (!row) {
    return `You are a study coach helping a student learn ${concept || 'this concept'} in ${subject || 'this subject'}. Use Mode A: beginner friendly, analogy-first, and define all terms clearly for someone who may be approaching the topic for the first time.

If no database entry exists, explain the idea slowly, give intuitive examples, and define every key term. Do not assume prior mastery.

${weakAreas ? `Weak areas: ${weakAreas}
` : ''}${strongAreas ? `Strong areas: ${strongAreas}
` : ''}`;
  }

  const mastery = String(row.mastery_level ?? '').trim();
  const userContext = [`You are a study coach helping a student learn ${concept || 'this concept'} in ${subject || 'this subject'}.`];
  const profile = [];
  if (weakAreas) profile.push(`Weak areas: ${weakAreas}`);
  if (strongAreas) profile.push(`Strong areas: ${strongAreas}`);
  const profileText = profile.length ? `Use the following learner profile:
- ${profile.join('\n- ')}` : 'No profile details are available.';

  if (mastery === 'Introduced' || mastery === 'Developing') {
    return `${userContext.join(' ')}\n\nMode B: reference prior knowledge, mention weak areas, and keep a moderate pace. Help the learner build confidence by connecting new ideas to what they may already understand.${profileText ? `\n\n${profileText}` : ''}`;
  }

  if (mastery === 'Proficient' || mastery === 'Strong') {
    return `${userContext.join(' ')}\n\nMode C: be technical, skip basic explanations, and focus on nuance, advanced connections, and subtle pitfalls. Assume the learner already understands core foundations.${profileText ? `\n\n${profileText}` : ''}`;
  }

  return `${userContext.join(' ')}\n\nMode A: beginner friendly, analogy-first, and define all terms. Use the learner profile when available to guide examples and pacing.${profileText ? `\n\n${profileText}` : ''}`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequestBody;

  if (typeof body.userMessage !== 'string' || typeof body.subject !== 'string' || typeof body.concept !== 'string') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const subject = body.subject.trim();
  const concept = body.concept.trim();
  const userMessage = body.userMessage.trim();

  if (!userMessage) {
    return NextResponse.json({ error: 'userMessage is required' }, { status: 400 });
  }

  let row: ConceptRow | null = null;

  if (subject && concept) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('concepts')
      .select('mastery_level, weak_areas, strong_areas')
      .eq('subject', subject)
      .eq('concept', concept)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Supabase query failed', details: error.message }, { status: 500 });
    }

    row = data as ConceptRow | null;
  }

  const systemPrompt = buildSystemPrompt(subject, concept, row);

  let result;
  try {
    const anthropic = getAnthropicProvider();
    result = await streamText({
      model: anthropic.languageModel('claude-sonnet-4-5'),
      system: systemPrompt,
      prompt: userMessage,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Anthropic request failed' }, { status: 500 });
  }

  return new NextResponse(result.textStream.pipeThrough(new TextEncoderStream()), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
