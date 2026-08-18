import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { QUICK_ACTIONS } from '@/types/chat';
import {
  Upload,
  LogOut,
  FileUp,
  CheckCircle2,
  Menu,
  BookOpen,
  X,
} from 'lucide-react';

interface SidebarProps {
  onQuickAction: (prompt: string) => void;
  onMenuClose: () => void;
}

type UploadState = 'idle' | 'uploading' | 'success';

export default function Sidebar({
  onQuickAction,
  onMenuClose,
}: SidebarProps) {
  const { user, signOut, getIdToken } = useAuth();

  const [uploadState, setUploadState] =
    useState<UploadState>('idle');

  const [uploadError, setUploadError] =
    useState<string | null>(null);

  const [dragging, setDragging] =
    useState(false);

  const [showGuide, setShowGuide] =
    useState(false);

  const inputRef =
    useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const allowed = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      const extOk =
        file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.docx');

      if (!extOk && !allowed.includes(file.type)) {
        setUploadError(
          'Only .pdf and .docx files are accepted.'
        );
        return;
      }

      setUploadError(null);
      setUploadState('uploading');

      try {
        const arrayBuffer =
          await file.arrayBuffer();

        const accessToken =
          await getIdToken();

        if (!accessToken) {
          throw new Error(
            'Authentication session expired. Please sign in again.'
          );
        }

        const functionUrl =
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/biobridge/upload`;

        const response = await fetch(
          functionUrl,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type':
                'application/octet-stream',
              'X-File-Name':
                encodeURIComponent(file.name),
              'X-File-Type':
                file.name
                  .toLowerCase()
                  .endsWith('.pdf')
                  ? 'pdf'
                  : 'docx',
            },
            body: arrayBuffer,
          }
        );

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        setUploadState('success');

        setTimeout(
          () => setUploadState('idle'),
          3000
        );
      } catch {
        setUploadError(
          'Upload failed. Try again.'
        );
        setUploadState('idle');
      }
    },
    [getIdToken]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);

      const file =
        e.dataTransfer.files[0];

      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file =
        e.target.files?.[0];

      if (file) {
        handleFile(file);
      }

      e.target.value = '';
    },
    [handleFile]
  );

  const displayName =
    user?.displayName ?? 'Engineer';

  const displayEmail =
    user?.email ?? '';

  const avatarUrl =
    user?.photoURL;

  return (
    <>
      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <div className="h-full flex flex-col bg-panel border-r border-hairline">

        {/* Account row */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-hairline">

          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-8 h-8 rounded-lg"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-panel-active flex items-center justify-center text-xs font-mono text-muted">
              {displayName
                .charAt(0)
                .toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">

            <p className="text-sm text-content font-medium truncate">
              {displayName}
            </p>

            <p className="text-xs text-muted truncate font-mono">
              {displayEmail}
            </p>

          </div>

          <button
            onClick={signOut}
            className="p-2 text-muted hover:text-content transition-colors duration-200 min-w-[40px] min-h-[40px] flex items-center justify-center"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>

        </div>

        {/* =====================================================
            UPLOAD ZONE
            ===================================================== */}

        <div className="px-4 py-4 border-b border-hairline">

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() =>
              setDragging(false)
            }
            onDrop={handleDrop}
            onClick={() =>
              inputRef.current?.click()
            }
            className={`border rounded-lg p-4 cursor-pointer transition-colors duration-200 min-h-[40px] ${
              dragging
                ? 'border-teal bg-teal/5'
                : uploadState === 'uploading'
                ? 'border-hairline bg-panel-active'
                : uploadState === 'success'
                ? 'border-teal/40 bg-teal/5'
                : 'border-hairline hover:border-muted/50'
            }`}
          >

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={handleSelect}
              className="hidden"
            />

            {uploadState === 'idle' && (
              <div className="flex flex-col items-center gap-2 text-center">

                <Upload
                  size={20}
                  className="text-muted"
                />

                <div>

                  <p className="text-sm text-content font-medium">
                    Upload reference documents
                  </p>

                  <p className="text-xs text-muted mt-0.5 font-mono">
                    .pdf or .docx — drag &amp; drop or click
                  </p>

                </div>

              </div>
            )}

            {uploadState === 'uploading' && (
              <div className="flex flex-col items-center gap-2 text-center">

                <FileUp
                  size={20}
                  className="text-teal animate-pulse-soft"
                />

                <p className="text-sm text-content font-medium">
                  Uploading &amp; indexing…
                </p>

              </div>
            )}

            {uploadState === 'success' && (
              <div className="flex flex-col items-center gap-2 text-center">

                <CheckCircle2
                  size={20}
                  className="text-teal"
                />

                <p className="text-sm text-content font-medium">
                  Document indexed
                </p>

              </div>
            )}

          </div>

          {uploadError && (
            <p className="mt-2 text-xs text-red-400 font-mono">
              {uploadError}
            </p>
          )}

        </div>

        {/* =====================================================
            PROMPT & DOCUMENT GUIDE BUTTON
            ===================================================== */}

        <div className="px-4 py-3 border-b border-hairline">

          <button
            onClick={() =>
              setShowGuide(true)
            }
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted hover:text-content hover:bg-panel-hover rounded-lg transition-colors duration-200"
          >

            <BookOpen size={15} />

            <span>
              Prompt &amp; Document Guide
            </span>

          </button>

        </div>

        {/* =====================================================
            QUICK ACTIONS
            ===================================================== */}

        <div className="flex-1 overflow-y-auto px-2 py-2">

          <p className="px-2 py-2 text-[11px] uppercase tracking-[0.12em] text-muted font-mono">
            Quick Actions
          </p>

          <div className="flex flex-col gap-0.5">

            {QUICK_ACTIONS.map(
              (action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    onQuickAction(
                      action.prompt
                    );
                    onMenuClose();
                  }}
                  className="text-left px-3 py-2 text-sm text-muted hover:text-content hover:bg-panel-hover rounded-lg transition-colors duration-200 min-h-[40px]"
                >
                  {action.label}
                </button>
              )
            )}

          </div>

        </div>

        {/* =====================================================
            MOBILE CLOSE
            ===================================================== */}

        <div className="px-4 py-3 border-t border-hairline md:hidden">

          <button
            onClick={onMenuClose}
            className="flex items-center gap-2 text-xs text-muted hover:text-content transition-colors min-h-[40px]"
          >

            <Menu size={14} />

            Close panel

          </button>

        </div>

      </div>

      {/* =====================================================
          PROMPT & DOCUMENT GUIDE MODAL
          ===================================================== */}

      {showGuide &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
            }}
          >

            {/* =================================================
                BACKDROP
                ================================================= */}

            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
              }}
              onClick={() =>
                setShowGuide(false)
              }
            />

            {/* =================================================
                MODAL CENTER
                ================================================= */}

            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                pointerEvents: 'none',
              }}
            >

              {/* =================================================
                  ACTUAL MODAL
                  ================================================= */}

              <div
                style={{
                  position: 'relative',
                  zIndex: 1000001,
                  pointerEvents: 'auto',
                  width: '100%',
                  maxWidth: '672px',
                  maxHeight: '85vh',
                  overflow: 'hidden',
                  backgroundColor: '#111318',
                  color: '#ffffff',
                  border: '1px solid #333842',
                  borderRadius: '12px',
                  boxShadow:
                    '0 25px 50px rgba(0, 0, 0, 0.6)',
                }}
                onClick={(e) =>
                  e.stopPropagation()
                }
              >

                {/* =================================================
                    HEADER
                    ================================================= */}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px',
                    borderBottom:
                      '1px solid #333842',
                    backgroundColor:
                      '#111318',
                  }}
                >

                  <div>

                    <h2
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#ffffff',
                      }}
                    >
                      Prompt &amp; Document Guide
                    </h2>

                    <p
                      style={{
                        margin: '6px 0 0',
                        fontSize: '12px',
                        color: '#9ca3af',
                      }}
                    >
                      How to get better results from BioBridge AI
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setShowGuide(false)
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      border: 'none',
                      borderRadius: '8px',
                      backgroundColor:
                        'transparent',
                      color: '#9ca3af',
                      cursor: 'pointer',
                    }}
                    title="Close"
                  >
                    <X size={18} />
                  </button>

                </div>

                {/* =================================================
                    CONTENT
                    ================================================= */}

                <div
                  style={{
                    overflowY: 'auto',
                    maxHeight:
                      'calc(85vh - 80px)',
                    padding: '20px',
                  }}
                >

                  {/* 1 */}
                  <section
                    style={{
                      marginBottom: '24px',
                    }}
                  >

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#ffffff',
                      }}
                    >
                      1. Be specific
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#9ca3af',
                      }}
                    >
                      Clearly mention what document you need,
                      what process, equipment, system, or subject
                      it should cover, and the intended purpose.
                    </p>

                  </section>

                  {/* 2 */}
                  <section
                    style={{
                      marginBottom: '24px',
                    }}
                  >

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#ffffff',
                      }}
                    >
                      2. Mention the required sections
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#9ca3af',
                      }}
                    >
                      Specify the sections you want, such as
                      Purpose, Scope, Responsibilities, Definitions,
                      Procedure, Acceptance Criteria, Documentation,
                      Risks, and Conclusion.
                    </p>

                  </section>

                  {/* 3 */}
                  <section
                    style={{
                      marginBottom: '24px',
                    }}
                  >

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#ffffff',
                      }}
                    >
                      3. Specify your sources
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#9ca3af',
                      }}
                    >
                      Tell BioBridge whether the answer should use
                      uploaded reference documents, internet research,
                      or both.
                    </p>

                  </section>

                  {/* 4 */}
                  <section
                    style={{
                      marginBottom: '24px',
                    }}
                  >

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#ffffff',
                      }}
                    >
                      4. Mention regulations or standards
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#9ca3af',
                      }}
                    >
                      Where applicable, mention FDA, EMA, ICH,
                      WHO, USP, ISO, GMP, or other relevant standards
                      and guidelines.
                    </p>

                  </section>

                  {/* 5 */}
                  <section
                    style={{
                      marginBottom: '24px',
                    }}
                  >

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#ffffff',
                      }}
                    >
                      5. Example of a good prompt
                    </h3>

                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: '#1a1d24',
                        border:
                          '1px solid #333842',
                        borderRadius: '8px',
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#d1d5db',
                      }}
                    >
                      Prepare a detailed SOP for equipment cleaning.
                      Use the uploaded reference documents as the
                      primary source and supplement missing current
                      regulatory information using authoritative
                      internet sources. Include Purpose, Scope,
                      Responsibilities, Definitions, Materials,
                      Procedure, Safety Precautions, Documentation,
                      and applicable regulatory requirements.
                    </div>

                  </section>

                  {/* 6 */}
                  <section
                    style={{
                      marginBottom: '24px',
                    }}
                  >

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#ffffff',
                      }}
                    >
                      6. For better technical documents
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#9ca3af',
                      }}
                    >
                      Mention the expected level of detail, target
                      audience, applicable regulations, required
                      acceptance criteria, equipment or process details,
                      and any specific company requirements.
                    </p>

                  </section>

                  {/* 7 */}
                  <section
                    style={{
                      marginBottom: '24px',
                    }}
                  >

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#ffffff',
                      }}
                    >
                      7. Always review the final document
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#9ca3af',
                      }}
                    >
                      Review generated documents for technical
                      accuracy, regulatory applicability, site-specific
                      requirements, completeness, and approval
                      requirements before official use.
                    </p>

                  </section>

                  {/* Tip */}
                  <div
                    style={{
                      borderTop:
                        '1px solid #333842',
                      paddingTop: '16px',
                    }}
                  >

                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        lineHeight: 1.5,
                        color: '#9ca3af',
                      }}
                    >

                      <span
                        style={{
                          color: '#ffffff',
                          fontWeight: 500,
                        }}
                      >
                        Tip:
                      </span>{' '}

                      The more specific your prompt, the more
                      targeted and useful the generated document
                      will be.

                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>,
          document.body
        )}

    </>
  );
}