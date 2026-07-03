import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

type DetectConceptRequestBody = {
  userMessage: string;
};

function getAnthropicProvider() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable.');
  }
  return createAnthropic({ apiKey });
}

const systemPrompt = `You are a utility that extracts structured study intent from a user message.
Return only valid JSON with exactly two fields: subject (string) and concept (string).
If the message is not about studying a concept, respond with {"subject":"","concept":""}.
Do not return any explanations, extra text, or markdown.
Example output: {"subject":"Biology","concept":"Cellular respiration"}`;

function parseStructuredJson(text: string) {
  const cleaned = text.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/{[\s\S]*}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as DetectConceptRequestBody;

  if (typeof body.userMessage !== 'string') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const userMessage = body.userMessage.trim();
  if (!userMessage) {
    return NextResponse.json({ error: 'userMessage is required' }, { status: 400 });
  }

  let result;

  try {
    const anthropic = getAnthropicProvider();
    result = await generateText({
      model: anthropic.languageModel('claude-sonnet-4-5'),
      system: systemPrompt,
      prompt: userMessage,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Anthropic request failed' }, { status: 500 });
  }

  const text = result.text.trim();
  const parsed = parseStructuredJson(text);
  const subject = typeof parsed?.subject === 'string' ? parsed.subject.trim() : '';
  const concept = typeof parsed?.concept === 'string' ? parsed.concept.trim() : '';

  return NextResponse.json({ subject, concept });
}
