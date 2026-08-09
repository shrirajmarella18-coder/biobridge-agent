import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '@/types/chat';
import { renderMarkdown } from '@/lib/markdown';
import { generateDocx, downloadBlob } from '@/lib/docx-export';
import { Send, Trash2, Download, FileText } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  onClear: () => void;
  generating: boolean;
  prefill: string | null;
  onPrefillConsumed: () => void;
}

export default function ChatPanel({
  messages,
  onSend,
  onClear,
  generating,
  prefill,
  onPrefillConsumed,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefill !== null) {
      setInput(prefill);
      onPrefillConsumed();
      textareaRef.current?.focus();
    }
  }, [prefill, onPrefillConsumed]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, generating]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || generating) return;
    onSend(trimmed);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleDownload(content: string) {
    const blob = await generateDocx(content);
    const ts = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `biobridge-document-${ts}.docx`);
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  useEffect(() => {
    autoResize();
  }, [input]);

  const isEmpty = messages.length === 0 && !generating;

  return (
    <div className="flex flex-col h-full bg-ink">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-3.5 border-b border-hairline">
        <h1 className="text-base font-semibold tracking-tight text-content">
          BioBridge AI
        </h1>
        <span className="w-2 h-2 rounded-full bg-teal glow-teal shrink-0" />
        <p className="text-xs text-muted font-mono truncate">
          Regulatory &amp; engineering document generation
        </p>
      </header>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {isEmpty ? (
          <div
            className="flex flex-col items-center justify-center h-full text-center max-w-xl mx-auto"
            style={{ animation: 'fadeUp 350ms ease-out forwards' }}
          >
            <h2 className="text-2xl font-semibold tracking-tight mb-3 gradient-text">
              Draft documents grounded in your own SOPs and current regulatory guidance
            </h2>
            <p className="text-sm text-muted leading-relaxed max-w-md">
              Upload reference documents to the left, then generate validation protocols, SOPs, risk assessments, and more — or ask a question about your uploaded materials.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {messages.map((msg, idx) => {
              const staggerDelay = Math.min(idx * 40, 400);
              if (msg.role === 'user') {
                return (
                  <div
                    key={msg.id}
                    className="msg-enter flex justify-end"
                    style={{
                      animation: `fadeUp 350ms ease-out ${staggerDelay}ms forwards`,
                    }}
                  >
                    <div className="max-w-[80%] bg-panel border border-hairline rounded-lg px-4 py-3">
                      <p className="text-sm text-content whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={msg.id}
                  className="msg-enter flex flex-col gap-2"
                  style={{
                    animation: `fadeUp 350ms ease-out ${staggerDelay}ms forwards`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-muted" />
                    <span className="text-xs font-mono text-muted uppercase tracking-wider">BioBridge AI</span>
                  </div>
                  <div
                    className="prose-bio bg-panel border border-hairline rounded-lg px-4 py-3 max-w-full"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                  <button
                    onClick={() => handleDownload(msg.content)}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-teal transition-colors duration-200 min-h-[40px] w-fit"
                  >
                    <Download size={13} />
                    Download as Word (.docx)
                  </button>
                </div>
              );
            })}

            {generating && (
              <div className="msg-enter flex flex-col gap-2" style={{ animation: 'fadeUp 350ms ease-out forwards' }}>
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-muted" />
                  <span className="text-xs font-mono text-muted uppercase tracking-wider">BioBridge AI</span>
                </div>
                <div className="bg-panel border border-hairline rounded-lg px-4 py-3">
                  <p className="text-sm text-muted animate-pulse-soft">Generating…</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-hairline px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-panel border border-hairline rounded-lg p-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Draft a validation protocol, generate an SOP, or ask about your documents…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-content placeholder:text-muted resize-none outline-none px-2 py-2 min-h-[40px] max-h-40"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || generating}
              className="p-2 text-muted hover:text-teal disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-[11px] text-muted font-mono">
              Enter to send, Shift+Enter for a new line
            </p>
            {messages.length > 0 && (
              <button
                onClick={onClear}
                disabled={generating}
                className="flex items-center gap-1.5 text-[11px] text-muted hover:text-red-400 disabled:opacity-40 transition-colors duration-200 min-h-[40px] px-2"
              >
                <Trash2 size={12} />
                Clear conversation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
