'use client';

import { useMemo, useState } from 'react';

type MessageRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  subject?: string;
  concept?: string;
  manualSubject?: string;
  manualConcept?: string;
  canSave?: boolean;
  saveStatus?: 'idle' | 'saving' | 'saved';
  saveError?: string;
};

type DetectConceptResponse = {
  subject: string;
  concept: string;
};

type SaveConceptPayload = {
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

function extractSection(text: string, headings: string[]): string {
  const pattern = headings
    .map((heading) => heading.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
    .join('|');
  const regex = new RegExp(`(?:${pattern})[:\n]+([\s\S]*?)(?=\n(?:overview|deep dive|strong areas|weak areas|next steps|notes)[:\n]|$)`, 'i');
  return (regex.exec(text)?.[1] ?? '').trim();
}

function parseList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ''))
    .filter((line) => line.length > 0);
}

function firstSentence(text: string): string {
  const match = text.trim().match(/^(.*?[.?!])\s+/);
  return match?.[1] ? match[1] : text.trim().slice(0, 240);
}

function parseSaveConceptPayload(text: string, subject: string, concept: string): SaveConceptPayload {
  const masteryMatch = text.match(/mastery level[:\s]*([A-Za-z]+)/i);
  const masteryLevel = masteryMatch?.[1] ?? 'Introduced';
  const overviewText = extractSection(text, ['Overview', 'Overview Gist', 'Summary']) || firstSentence(text);
  const deepDiveText = extractSection(text, ['Deep Dive', 'Deep Dive Gist']) || '';
  const strongAreasText = extractSection(text, ['Strong Areas', 'Strengths']) || '';
  const weakAreasText = extractSection(text, ['Weak Areas', 'Weaknesses', 'Challenges']) || '';
  const nextStepsText = extractSection(text, ['Next Steps', 'To do next', 'Action Items']) || '';

  return {
    subject,
    concept,
    masteryLevel,
    overviewGist: overviewText,
    deepDiveGist: deepDiveText ? parseList(deepDiveText) : [],
    strongAreas: strongAreasText ? parseList(strongAreasText) : [],
    weakAreas: weakAreasText ? parseList(weakAreasText) : [],
    nextSteps: nextStepsText ? parseList(nextStepsText) : [],
    notes: text.trim(),
  };
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const canSend = inputValue.trim().length > 0 && !isSending;

  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message) return;

    setInputValue('');
    setStatusMessage('Detecting concept...');
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: message,
    };
    setMessages((current) => [...current, userMessage]);
    setIsSending(true);

    let subject = '';
    let concept = '';

    try {
      const detectResponse = await fetch('/api/detect-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: message }),
      });

      if (detectResponse.ok) {
        const detection = (await detectResponse.json()) as DetectConceptResponse;
        subject = detection.subject ?? ''; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
        concept = detection.concept ?? ''; // eslint-disable-line @typescript-eslint/no-unsafe-assignment
      }
    } catch (error) {
      console.error('Concept detection failed', error);
    }

    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      subject,
      concept,
      manualSubject: '',
      manualConcept: '',
      canSave: false,
      saveStatus: 'idle',
    };
    setMessages((current) => [...current, assistantMessage]);

    try {
      setStatusMessage('Generating response...');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: message, subject, concept }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to generate chat response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantText = '';

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) {
          done = true;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;
        setMessages((current) =>
          current.map((item) => (item.id === assistantId ? { ...item, text: assistantText } : item)),
        );
      }

      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text: assistantText,
                canSave: Boolean(subject && concept),
              }
            : item,
        ),
      );
    } catch (error) {
      console.error(error);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                text: item.text + '\n\n[Failed to load response.]',
                canSave: Boolean(subject && concept),
              }
            : item,
        ),
      );
    } finally {
      setStatusMessage('');
      setIsSending(false);
    }
  };

  const handleSave = async (message: ChatMessage) => {
    const subject = message.subject || message.manualSubject || '';
    const concept = message.concept || message.manualConcept || '';
    if (!subject || !concept) return;

    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, saveStatus: 'saving', saveError: undefined } : item,
      ),
    );

    const payload = parseSaveConceptPayload(message.text, subject, concept);

    try {
      const saveResponse = await fetch('/api/save-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!saveResponse.ok) {
        const body = await saveResponse.json();
        throw new Error(body?.error || 'Save failed');
      }

      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, saveStatus: 'saved', saveError: undefined } : item,
        ),
      );
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unable to save progress';
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, saveStatus: 'idle', saveError: messageText } : item,
        ),
      );
    }
  };

  const renderedMessages = messages.map((message) => (
    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} py-2`}> 
      <div className={`${message.role === 'user' ? 'rounded-3xl rounded-br-none bg-sky-700 text-slate-100' : 'rounded-3xl rounded-bl-none bg-slate-900 text-slate-100'} max-w-[80%] px-4 py-3 shadow-sm`}>
        <div className="text-sm leading-7 whitespace-pre-wrap">{message.text || (message.role === 'assistant' ? '...' : '')}</div>
        {message.role === 'assistant' && message.saveStatus !== 'saved' ? (
          <div className="mt-3 rounded-3xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
            {message.canSave ? (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleSave(message)}
                  className="rounded-full bg-slate-700 px-3 py-1 text-slate-100 transition hover:bg-slate-600"
                >
                  {message.saveStatus === 'saving' ? 'Saving…' : 'Save progress'}
                </button>
                {message.subject && message.concept ? (
                  <span className="text-slate-400">{message.subject} · {message.concept}</span>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-400">No auto-detected concept. Enter a subject and concept to save progress manually.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={message.manualSubject ?? ''}
                    onChange={(event) =>
                      setMessages((current) =>
                        current.map((item) =>
                          item.id === message.id
                            ? { ...item, manualSubject: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="Subject"
                    className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  <input
                    type="text"
                    value={message.manualConcept ?? ''}
                    onChange={(event) =>
                      setMessages((current) =>
                        current.map((item) =>
                          item.id === message.id
                            ? { ...item, manualConcept: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="Concept"
                    className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSave(message)}
                  disabled={!(message.manualSubject?.trim() && message.manualConcept?.trim())}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-slate-700 px-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800"
                >
                  {message.saveStatus === 'saving' ? 'Saving…' : 'Save progress manually'}
                </button>
              </div>
            )}
          </div>
        ) : null}
        {message.role === 'assistant' && message.saveStatus === 'saved' ? (
          <p className="mt-3 text-xs text-emerald-400">Progress saved.</p>
        ) : null}
        {message.role === 'assistant' && message.saveError ? (
          <p className="mt-3 text-xs text-rose-400">{message.saveError}</p>
        ) : null}
      </div>
    </div>
  ));

  const footerLabel = isSending ? 'Working on your question…' : 'Ask anything about learning a concept.';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 bg-slate-950/95 px-4 py-4 shadow-sm shadow-black/20 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Study Agent</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a href="/" className="rounded-full bg-slate-900 px-4 py-2 text-slate-100 transition hover:bg-slate-800">Chat</a>
            <a href="/dashboard" className="rounded-full bg-slate-900 px-4 py-2 text-slate-100 transition hover:bg-slate-800">Dashboard</a>
          </div>
        </div>
      </div>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/80 px-6 py-5 shadow-lg shadow-black/30 backdrop-blur">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Study Agent</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Learning chat</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Ask a study question, get targeted guidance, then save progress when a concept is detected.</p>
          </div>
          <div className="rounded-3xl bg-slate-800 px-4 py-2 text-sm text-slate-300">No auth · Single user</div>
        </div>

        <div className="flex-1 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-inner shadow-black/30">
          <div className="flex h-[calc(100vh-260px)] flex-col overflow-y-auto px-6 py-6">
            <div className="space-y-2">{renderedMessages}</div>
          </div>

          <div className="border-t border-slate-800 bg-slate-950 px-6 py-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-slate-500">
              <span>{footerLabel}</span>
              <span>{messages.length} messages</span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                rows={2}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Type your study question here..."
                className="min-h-[80px] flex-1 rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
              <button
                type="button"
                disabled={!canSend}
                onClick={handleSend}
                className="inline-flex h-14 items-center justify-center rounded-3xl bg-sky-600 px-6 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
