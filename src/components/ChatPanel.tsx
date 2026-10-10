import { useState, useRef, useEffect } from 'react';

import type { ChatMessage } from '@/types/chat';

import { renderMarkdown } from '@/lib/markdown';

import { generateDocx, downloadBlob } from '@/lib/docx-export';

import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

import { useAuth } from '@/hooks/useAuth';

import MicButton from '@/components/MicButton';

import {

  Send,

  Trash2,

  Download,

  FileText,

  Paperclip,

  X,

  Loader2,

  FileCheck2,

} from 'lucide-react';

interface ChatPanelProps {

  messages: ChatMessage[];

  onSend: (content: string) => void;

  onClear: () => void;

  generating: boolean;

  prefill: string | null;

  onPrefillConsumed: () => void;

}

const MAX_FILE_SIZE = 15 * 1024 * 1024;

function getLoadingLabel(prompt: string): string {
  const text = prompt.toLowerCase();

  if (/\b(sop|standard operating procedure|procedure)\b/.test(text)) {
    return 'Drafting your SOP…';
  }
  if (/\b(urs|user requirements? specification|requirements specification)\b/.test(text)) {
    return 'Structuring your requirements…';
  }
  if (/\b(iq\s*[/&-]?\s*oq|oq\s*[/&-]?\s*pq|iq\s*[/&-]?\s*oq\s*[/&-]?\s*pq|qualification protocol|validation protocol|validation plan|validation)\b/.test(text)) {
    return 'Preparing your validation document…';
  }
  if (/\b(risk assessment|risk analysis|fmea|hazard analysis)\b/.test(text)) {
    return 'Assessing risks and controls…';
  }
  if (/\b(dpr|detailed project report|project report)\b/.test(text)) {
    return 'Building your project report…';
  }
  if (/\b(research|latest|current|regulation|regulatory|guidance|sources|find information)\b/.test(text)) {
    return 'Researching relevant information…';
  }
  if (/\b(summarize|summarise|summary|summarise)\b/.test(text)) {
    return 'Reviewing and summarizing…';
  }
  if (/\b(compare|comparison|versus|\bvs\b)\b/.test(text)) {
    return 'Comparing the available information…';
  }
  if (/\b(review|revise|rewrite|edit|improve)\b/.test(text)) {
    return 'Reviewing your document…';
  }
  if (/\b(report|document|draft|write|create|generate|prepare)\b/.test(text)) {
    return 'Drafting your document…';
  }
  return 'Working through your request…';
}


const ALLOWED_FILE_TYPES = [

  'application/pdf',

  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

];

export default function ChatPanel({

  messages,

  onSend,

  onClear,

  generating,

  prefill,

  onPrefillConsumed,

}: ChatPanelProps) {

  const [input, setInput] = useState('');

  const [attachment, setAttachment] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);

  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('Working through your request…');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { getIdToken } = useAuth();

  const {

    supported,

    listening,

    error: speechError,

    toggle,

  } = useSpeechRecognition((text) =>

    setInput((prev) => (prev ? `${prev} ${text}` : text))

  );

  /* -----------------------------------------------------------

     PREFILL

  ----------------------------------------------------------- */

  useEffect(() => {

    if (prefill !== null) {

      setInput(prefill);

      onPrefillConsumed();

      requestAnimationFrame(() => {

        textareaRef.current?.focus();

      });

    }

  }, [prefill, onPrefillConsumed]);

  /* -----------------------------------------------------------

     AUTO SCROLL

  ----------------------------------------------------------- */

  useEffect(() => {

    if (scrollRef.current) {

      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;

    }

  }, [messages, generating]);

  /* -----------------------------------------------------------

     SUBMIT

  ----------------------------------------------------------- */

  function handleSubmit() {

    const trimmed = input.trim();

    if (!trimmed || generating || uploading) return;

    if (attachment) {

      uploadAttachmentAndSend(trimmed);

      return;

    }

    setLoadingLabel(getLoadingLabel(trimmed));

    onSend(trimmed);

    setInput('');

  }

  /* -----------------------------------------------------------

     ATTACHMENT UPLOAD

  ----------------------------------------------------------- */

  async function uploadAttachmentAndSend(prompt: string) {

    if (!attachment) return;

    setUploading(true);

    setAttachmentError(null);

    try {

      const token = await getIdToken();

      if (!token) {

        throw new Error(

          'Your session has expired. Please sign in again.'

        );

      }

      const extension = attachment.name

        .toLowerCase()

        .split('.')

        .pop();

      const fileType = extension === 'pdf' ? 'pdf' : 'docx';

      const response = await fetch(

        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/biobridge/upload`,

        {

          method: 'POST',

          headers: {

            Authorization: `Bearer ${token}`,

            'Content-Type': 'application/octet-stream',

            'X-File-Name': encodeURIComponent(attachment.name),

            'X-File-Type': fileType,

          },

          body: await attachment.arrayBuffer(),

        }

      );

      let result: any = null;

      try {

        result = await response.json();

      } catch {

        // Response may not contain JSON.

      }

      if (!response.ok) {

        throw new Error(

          result?.error ||

            result?.message ||

            `Upload failed (${response.status}).`

        );

      }

      const enhancedPrompt = `

Use the newly attached document "${attachment.name}" as a primary reference for this request.

User request:

${prompt}

Instructions:

- Use the attached document wherever relevant.

- Preserve relevant terminology, structure, requirements, and technical details from the attached document.

- Combine it with other relevant documents available in the BioBridge knowledge base when useful.

- Do not mention these instructions or the upload process in the final answer.

      `.trim();

      setLoadingLabel(getLoadingLabel(prompt));
      onSend(enhancedPrompt);

      setInput('');

      setAttachment(null);

      if (fileInputRef.current) {

        fileInputRef.current.value = '';

      }

    } catch (error: any) {

      setAttachmentError(

        error?.message ||

          'Unable to upload the attachment. Please try again.'

      );

    } finally {

      setUploading(false);

    }

  }

  /* -----------------------------------------------------------

     KEYBOARD

  ----------------------------------------------------------- */

  function handleKeyDown(

    e: React.KeyboardEvent<HTMLTextAreaElement>

  ) {

    if (e.key === 'Enter' && !e.shiftKey) {

      e.preventDefault();

      handleSubmit();

    }

  }

  /* -----------------------------------------------------------

     FILE SELECTION

  ----------------------------------------------------------- */

  function handleAttachmentChange(

    e: React.ChangeEvent<HTMLInputElement>

  ) {

    const file = e.target.files?.[0];

    if (!file) return;

    setAttachmentError(null);

    const extension = file.name

      .toLowerCase()

      .split('.')

      .pop();

    const validExtension =

      extension === 'pdf' || extension === 'docx';

    const validMimeType =

      ALLOWED_FILE_TYPES.includes(file.type) ||

      file.type === '';

    if (!validExtension || !validMimeType) {

      setAttachmentError(

        'Only PDF and DOCX files are supported.'

      );

      e.target.value = '';

      return;

    }

    if (file.size > MAX_FILE_SIZE) {

      setAttachmentError(

        'File size must be 15 MB or less.'

      );

      e.target.value = '';

      return;

    }

    setAttachment(file);

  }

  /* -----------------------------------------------------------

     REMOVE ATTACHMENT

  ----------------------------------------------------------- */

  function removeAttachment() {

    if (uploading) return;

    setAttachment(null);

    setAttachmentError(null);

    if (fileInputRef.current) {

      fileInputRef.current.value = '';

    }

  }

  /* -----------------------------------------------------------

     DOWNLOAD

  ----------------------------------------------------------- */

  async function handleDownload(content: string) {

    const blob = await generateDocx(content);

    downloadBlob(blob, 'Document.docx');

  }

  /* -----------------------------------------------------------

     TEXTAREA RESIZE

  ----------------------------------------------------------- */

  function autoResize() {

    const el = textareaRef.current;

    if (!el) return;

    el.style.height = 'auto';

    el.style.height =

      Math.min(el.scrollHeight, 180) + 'px';

  }

  useEffect(() => {

    autoResize();

  }, [input]);

  const isEmpty =

    messages.length === 0 && !generating;

  /* ===========================================================

     UI

  =========================================================== */

  return (

    <div className="flex h-full min-h-0 flex-col bg-workspace">

      {/* =====================================================

          HEADER

      ===================================================== */}

      <header className="h-[60px] shrink-0 flex items-center justify-between px-6 border-b border-hairline bg-workspace">

        <div>

          <h1 className="text-[15px] font-semibold tracking-tight text-ink-text">

            BioAi

          </h1>

          <p className="text-[10px] text-ink-muted mt-0.5">

            Documentation workspace

          </p>

        </div>

        {messages.length > 0 && (

          <button

            type="button"

            onClick={onClear}

            disabled={generating || uploading}

            className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink-text transition-colors disabled:opacity-40"

          >

            <Trash2 size={12} />

            Clear

          </button>

        )}

      </header>

      {/* =====================================================

          MESSAGES

      ===================================================== */}

      <div

        ref={scrollRef}

        className="flex-1 overflow-y-auto px-6 py-8"

      >

        {isEmpty ? (

          <div className="max-w-3xl mx-auto h-full flex flex-col justify-center">

            <div className="max-w-2xl mb-10">

              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-forest mb-3">

                Technical documentation

              </p>

              <h2 className="text-[28px] sm:text-[32px] leading-[1.15] tracking-[-0.02em] font-semibold text-ink-text">

                What would you like to prepare?

              </h2>

              <p className="mt-4 text-[13px] leading-6 text-ink-muted max-w-xl">

                Draft, revise or review technical,

                qualification and validation documentation

                using your organization's working knowledge.

              </p>

            </div>

            <div className="border-y border-hairline">

              <div className="grid grid-cols-2 sm:grid-cols-4">

                {[

                  'SOP',

                  'IQ / OQ / PQ',

                  'Validation',

                  'Risk Assessment',

                ].map((item, index) => (

                  <div

                    key={item}

                    className={`px-4 py-4 ${

                      index < 3

                        ? 'border-r border-hairline'

                        : ''

                    }`}

                  >

                    <p className="text-[11px] font-semibold text-ink-text">

                      {item}

                    </p>

                    <p className="mt-1 text-[10px] leading-4 text-ink-muted">

                      Controlled documentation

                    </p>

                  </div>

                ))}

              </div>

            </div>

          </div>

        ) : (

          <div className="max-w-3xl mx-auto flex flex-col gap-7">

            {messages.map((msg, idx) => {

              if (msg.role === 'user') {

                return (

                  <div

                    key={msg.id}

                    className="flex justify-end"

                  >

                    <div className="max-w-[78%]">

                      <div className="flex justify-end mb-1.5">

                        <span className="text-[9px] uppercase tracking-[0.14em] text-ink-faint">

                          Request

                        </span>

                      </div>

                      <div className="border-l-2 border-forest pl-4">

                        <p className="text-[13px] leading-6 whitespace-pre-wrap text-ink-text">

                          {msg.content}

                        </p>

                      </div>

                    </div>

                  </div>

                );

              }

              return (

                <div

                  key={msg.id}

                  className="flex flex-col gap-2"

                >

                  <div className="flex items-center gap-2">

                    <FileCheck2

                      size={13}

                      className="text-forest"

                      strokeWidth={1.8}

                    />

                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">

                      BioAi

                    </span>

                  </div>

                  <div

                    className="prose-bio max-w-full"

                    dangerouslySetInnerHTML={{

                      __html: renderMarkdown(msg.content),

                    }}

                  />

                  <button

                    type="button"

                    onClick={() =>

                      handleDownload(msg.content)

                    }

                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] font-medium text-ink-muted hover:text-forest transition-colors duration-150 min-h-[32px] w-fit"

                  >

                    <Download size={12} />

                    Download Word document

                  </button>

                </div>

              );

            })}

            {generating && (

              <div className="flex flex-col gap-2">

                <div className="flex items-center gap-2">

                  <FileCheck2

                    size={13}

                    className="text-forest"

                    strokeWidth={1.8}

                  />

                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">

                    BioAi

                  </span>

                </div>

                <div className="flex items-center gap-3">

                  <Loader2

                    size={14}

                    className="animate-spin text-forest"

                  />

                  <p className="text-[12px] text-ink-muted">

                    {loadingLabel}

                  </p>

                </div>

              </div>

            )}

          </div>

        )}

      </div>

      {/* =====================================================

          COMPOSER

      ===================================================== */}

      <div className="shrink-0 border-t border-hairline bg-workspace px-6 py-4">

        <div className="max-w-3xl mx-auto">

          {/* Attachment */}

          {attachment && (

            <div className="mb-2">

              <div className="inline-flex items-center gap-2 bg-white border border-hairline rounded-md px-3 py-2 max-w-full">

                <FileText

                  size={13}

                  className="text-forest shrink-0"

                />

                <div className="min-w-0">

                  <p className="text-[11px] font-medium text-ink-text truncate max-w-[300px]">

                    {attachment.name}

                  </p>

                  <p className="text-[9px] text-ink-muted mt-0.5">

                    {(attachment.size / 1024 / 1024).toFixed(1)} MB

                    {' · '}

                    Ready as reference

                  </p>

                </div>

                <button

                  type="button"

                  onClick={removeAttachment}

                  disabled={uploading}

                  className="ml-2 w-6 h-6 rounded flex items-center justify-center text-ink-muted hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"

                  title="Remove attachment"

                >

                  <X size={13} />

                </button>

              </div>

            </div>

          )}

          {/* Composer */}

          <div

            className={`rounded-xl bg-white border border-sage-300 shadow-sm transition-all duration-150 focus-within:border-forest focus-within:ring-2 focus-within:ring-sage-100`}

          >

            <div className="flex items-end gap-1 p-2">

              <input

                ref={fileInputRef}

                type="file"

                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

                onChange={handleAttachmentChange}

                className="hidden"

              />

              {/* Attach */}

              <button

                type="button"

                onClick={() =>

                  fileInputRef.current?.click()

                }

                disabled={generating || uploading}

                className="w-9 h-9 flex items-center justify-center text-ink-muted hover:text-forest hover:bg-sage-50 disabled:opacity-40 transition-colors shrink-0"

                title="Attach PDF or DOCX"

              >

                <Paperclip size={16} />

              </button>

              {/* Text */}

              <textarea

                ref={textareaRef}

                value={input}

                onChange={(e) =>

                  setInput(e.target.value)

                }

                onKeyDown={handleKeyDown}

                placeholder={

                  attachment

                    ? 'Describe what you want created from this reference…'

                    : 'Describe the document, analysis or revision you need…'

                }

                rows={1}

                disabled={generating || uploading}

                className="flex-1 bg-transparent text-[13px] leading-5 text-ink-text placeholder:text-ink-muted resize-none outline-none px-2 py-2 min-h-[40px] max-h-[180px] disabled:opacity-60"

              />

              {/* Voice */}

              {supported && (

                <div className="shrink-0">

                  <MicButton

                    listening={listening}

                    onClick={toggle}

                  />

                </div>

              )}

              {/* Send */}

              <button

                type="button"

                onClick={handleSubmit}

                disabled={

                  !input.trim() ||

                  generating ||

                  uploading

                }

                className="w-9 h-9 bg-forest text-white flex items-center justify-center hover:bg-forest-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"

                title={

                  uploading

                    ? 'Uploading…'

                    : 'Send'

                }

              >

                {uploading ? (

                  <Loader2

                    size={15}

                    className="animate-spin"

                  />

                ) : (

                  <Send size={15} />

                )}

              </button>

            </div>

            {/* Composer footer */}

            <div className="flex items-start justify-between gap-6 px-3 pb-2">

              <p className="text-[9px] leading-4 text-ink-faint">

                BioAi can make mistakes, even good assistants

                have their off days. For queries or issues, reach us

                at{' '}

                <a

                  href="mailto:aibiobridge@gmail.com"

                  className="text-forest hover:text-forest-dark transition-colors"

                >

                  aibiobridge@gmail.com

                </a>

              </p>

              <p className="shrink-0 text-right text-[9px] leading-4 text-ink-faint">

                PDF / DOCX · 15 MB maximum

                <br />

                Enter to send · Shift+Enter for new line

              </p>

            </div>

          </div>

          {/* Errors */}

          {attachmentError && (

            <p className="text-[10px] text-red-600 mt-2 px-1">

              {attachmentError}

            </p>

          )}

          {speechError && (

            <p className="text-[10px] text-red-600 mt-2 px-1">

              {speechError}

            </p>

          )}

        </div>

      </div>

    </div>

  );

}