import { useState, useCallback } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import ChatPanel from '@/components/ChatPanel';
import type { ChatMessage } from '@/types/chat';
import { useAuth } from '@/hooks/useAuth';



export default function AppPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prefill, setPrefill] = useState<string | null>(null);
  const { getIdToken } = useAuth();

  const handleSend = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setGenerating(true);

    try {
      const accessToken = await getIdToken();
      if (!accessToken) throw new Error('Authentication session expired. Please sign in again.');

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/biobridge/generate`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: content }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? 'Generation request failed');

      let assistantContent = data.response ?? data.message ?? 'The generation service returned no response.';

      const documentSources = Array.isArray(data.document_sources) ? data.document_sources : [];
      const webSources = Array.isArray(data.web_sources) ? data.web_sources : [];
      if (documentSources.length || webSources.length) {
        assistantContent += '\n\n---\n\n### Sources used\n';
        if (documentSources.length) {
          assistantContent += '\n**Uploaded documents**\n';
          for (const source of documentSources) {
            assistantContent += `- **${source.id}** — ${source.filename} (chunk ${source.chunk})\n`;
          }
        }
        if (webSources.length) {
          assistantContent += '\n**Live web sources**\n';
          for (const source of webSources) {
            assistantContent += `- **${source.id}** — [${source.title}](${source.url})\n`;
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantContent,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'The request could not be completed. Check your connection and try again. If the problem persists, the generation service may not yet be configured.',
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setGenerating(false);
    }
  }, [getIdToken]);

  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  const handleQuickAction = useCallback((prompt: string) => {
    setPrefill(prompt);
  }, []);

  const handlePrefillConsumed = useCallback(() => {
    setPrefill(null);
  }, []);

  return (
    <div className="h-screen flex bg-ink overflow-hidden">
      {/* Mobile menu button */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden fixed top-3 left-3 z-30 p-2 bg-panel border border-hairline rounded-lg text-muted hover:text-content transition-colors duration-200 min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Sidebar — desktop */}
      <div className="hidden md:flex w-72 shrink-0">
        <Sidebar onQuickAction={handleQuickAction} onMenuClose={() => setSidebarOpen(false)} />
      </div>

      {/* Sidebar — mobile overlay */}
      {sidebarOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-ink/60 z-40"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="md:hidden fixed left-0 top-0 bottom-0 w-72 z-50"
            style={{ animation: 'fadeUp 200ms ease-out forwards' }}
          >
            <Sidebar onQuickAction={handleQuickAction} onMenuClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Chat panel */}
      <div className="flex-1 min-w-0">
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          onClear={handleClear}
          generating={generating}
          prefill={prefill}
          onPrefillConsumed={handlePrefillConsumed}
        />
      </div>
    </div>
  );
}
