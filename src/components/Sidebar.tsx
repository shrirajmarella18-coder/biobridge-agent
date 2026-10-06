import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { QUICK_ACTIONS } from '@/types/chat';
import {
  LogOut,
  Menu,
  BookOpen,
  X,
  ChevronRight,
  FileText,
  ClipboardList,
  CheckCircle2,
  Settings2,
  ShieldCheck,
  Factory,
  FileCheck2,
  TriangleAlert,
  MessageSquare,
} from 'lucide-react';

interface SidebarProps {
  onQuickAction: (prompt: string) => void;
  onMenuClose: () => void;
}

export default function Sidebar({
  onQuickAction,
  onMenuClose,
}: SidebarProps) {
  const { user, signOut } = useAuth();
  const [showGuide, setShowGuide] = useState(false);

  const displayName = user?.displayName ?? 'Engineer';
  const displayEmail = user?.email ?? '';
  const avatarUrl = user?.photoURL;

  return (
    <>
      <div className="h-full flex flex-col bg-sidebar border-r border-hairline">

        {/* =====================================================
            ACCOUNT
            ===================================================== */}

        <div className="px-4 py-4 border-b border-hairline">
          <div className="flex items-center gap-3">

            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-9 h-9 rounded-md object-cover border border-hairline"
              />
            ) : (
              <div className="w-9 h-9 rounded-md bg-sage-100 border border-sage-200 flex items-center justify-center text-xs font-semibold text-forest">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-text font-semibold truncate">
                {displayName}
              </p>

              <p className="text-[11px] text-ink-muted truncate">
                {displayEmail}
              </p>
            </div>

            <button
              onClick={signOut}
              className="p-2 text-ink-muted hover:text-ink-text hover:bg-white rounded-md transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>

          </div>
        </div>

        {/* =====================================================
            GUIDE
            ===================================================== */}

        <div className="px-3 py-3 border-b border-hairline">

          <button
            onClick={() => setShowGuide(true)}
            className="group w-full flex items-center gap-3 px-3 py-3 text-left rounded-md text-ink-muted hover:text-ink-text hover:bg-white transition-colors duration-150"
          >

            <span className="w-8 h-8 rounded-md bg-white border border-hairline flex items-center justify-center shrink-0 group-hover:border-sage-200 group-hover:text-forest transition-colors">
              <BookOpen size={14} />
            </span>

            <span className="flex-1 min-w-0">

              <span className="block text-sm font-medium">
                Prompt &amp; Document Guide
              </span>

              <span className="block text-[11px] text-ink-muted mt-0.5">
                Write better technical requests
              </span>

            </span>

            <ChevronRight
              size={15}
              className="text-ink-faint group-hover:text-forest transition-colors"
            />

          </button>

        </div>

        {/* =====================================================
            QUICK ACTIONS
            ===================================================== */}

        <div className="flex-1 overflow-y-auto px-3 py-5">

          <div className="px-2 mb-4">

            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Workspace
            </p>

            <p className="text-xs text-ink-muted mt-1">
              Common document workflows
            </p>

          </div>

          <div className="space-y-5">

            {(() => {
              let lastCategory = '';

              return QUICK_ACTIONS.map((action) => {

                const label = action.label.toLowerCase();

                const category =
                  label.includes('dpr') ||
                  label.includes('urs') ||
                  label.includes('sop')
                    ? 'Documentation'
                    : label.includes('iq') ||
                      label.includes('oq') ||
                      label.includes('pq') ||
                      label.includes('fat') ||
                      label.includes('sat')
                    ? 'Qualification'
                    : label.includes('validation') ||
                      label.includes('risk')
                    ? 'Validation & Risk'
                    : 'Knowledge';

                const showCategory = category !== lastCategory;
                lastCategory = category;

                const Icon =
                  label.includes('sop')
                    ? FileText
                    : label.includes('urs')
                    ? ClipboardList
                    : label.includes('iq')
                    ? CheckCircle2
                    : label.includes('oq')
                    ? Settings2
                    : label.includes('pq')
                    ? ShieldCheck
                    : label.includes('fat')
                    ? Factory
                    : label.includes('sat')
                    ? ShieldCheck
                    : label.includes('validation')
                    ? FileCheck2
                    : label.includes('risk')
                    ? TriangleAlert
                    : label.includes('ask')
                    ? MessageSquare
                    : FileText;

                const subtitle =
                  label.includes('dpr')
                    ? 'Detailed project requirements'
                    : label.includes('urs')
                    ? 'User requirements specification'
                    : label.includes('sop')
                    ? 'Standard operating procedure'
                    : label.includes('iq')
                    ? 'Installation qualification'
                    : label.includes('oq')
                    ? 'Operational qualification'
                    : label.includes('pq')
                    ? 'Performance qualification'
                    : label.includes('fat')
                    ? 'Factory acceptance testing'
                    : label.includes('sat')
                    ? 'Site acceptance testing'
                    : label.includes('validation')
                    ? 'Validation documentation'
                    : label.includes('risk')
                    ? 'Risk identification and assessment'
                    : 'Search your reference material';

                return (
                  <div key={action.label}>

                    {showCategory && (
                      <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                        {category}
                      </p>
                    )}

                    <button
                      onClick={() => {
                        onQuickAction(action.prompt);
                        onMenuClose();
                      }}
                      className="group w-full flex items-center gap-3 text-left px-2.5 py-2.5 rounded-md hover:bg-white border border-transparent hover:border-hairline transition-all duration-150"
                    >

                      <span className="w-8 h-8 rounded-md bg-white border border-hairline flex items-center justify-center shrink-0 text-ink-muted group-hover:text-forest group-hover:border-sage-200 transition-colors">
                        <Icon
                          size={15}
                          strokeWidth={1.8}
                        />
                      </span>

                      <span className="min-w-0 flex-1">

                        <span className="block text-[13px] font-medium text-ink-text truncate">
                          {action.label.replace(/^Generate /, '')}
                        </span>

                        <span className="block text-[10px] text-ink-muted mt-0.5 truncate">
                          {subtitle}
                        </span>

                      </span>

                      <ChevronRight
                        size={14}
                        className="text-ink-faint group-hover:text-forest transition-colors"
                      />

                    </button>

                  </div>
                );
              });
            })()}

          </div>

        </div>

        {/* =====================================================
            KNOWLEDGE NOTE
            ===================================================== */}

        <div className="px-4 py-3 border-t border-hairline bg-sidebar">

          <div className="flex items-start gap-2.5">

            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-forest shrink-0" />

            <div>

              <p className="text-[11px] font-medium text-ink-text">
                Reference-aware generation
              </p>

              <p className="text-[10px] leading-4 text-ink-muted mt-0.5">
                Attach a PDF or DOCX in the composer to use it as a working reference.
              </p>

            </div>

          </div>

        </div>

        {/* =====================================================
            MOBILE CLOSE
            ===================================================== */}

        <div className="px-4 py-3 border-t border-hairline md:hidden bg-sidebar">

          <button
            onClick={onMenuClose}
            className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink-text transition-colors min-h-[40px]"
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
              backgroundColor: 'rgba(24, 28, 25, 0.42)',
            }}
          >

            {/* Backdrop */}

            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(24, 28, 25, 0.42)',
              }}
              onClick={() => setShowGuide(false)}
            />

            {/* Modal center */}

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

              {/* Actual modal */}

              <div
                style={{
                  pointerEvents: 'auto',
                  width: '100%',
                  maxWidth: '720px',
                  maxHeight: '85vh',
                  backgroundColor: '#FAFBF8',
                  border: '1px solid #D9DDD7',
                  borderRadius: '12px',
                  boxShadow: '0 24px 60px rgba(24, 28, 25, 0.18)',
                  overflow: 'hidden',
                }}
              >

                {/* Modal header */}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 20px',
                    borderBottom: '1px solid #D9DDD7',
                    backgroundColor: '#F5F7F3',
                  }}
                >

                  <div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: '#66736A',
                      }}
                    >
                      BioBridge AI
                    </p>

                    <h2
                      style={{
                        margin: '5px 0 0',
                        fontSize: '18px',
                        fontWeight: 650,
                        color: '#1C211E',
                      }}
                    >
                      Prompt &amp; Document Guide
                    </h2>

                  </div>

                  <button
                    onClick={() => setShowGuide(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      border: 'none',
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      color: '#687169',
                      cursor: 'pointer',
                    }}
                    title="Close"
                  >
                    <X size={18} />
                  </button>

                </div>

                {/* Modal content */}

                <div
                  style={{
                    overflowY: 'auto',
                    maxHeight: 'calc(85vh - 80px)',
                    padding: '20px',
                  }}
                >

                  {/* 1 */}

                  <section style={{ marginBottom: '24px' }}>

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1C211E',
                      }}
                    >
                      1. Be specific
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#687169',
                      }}
                    >
                      Clearly mention what document you need,
                      what process, equipment, system, or subject
                      it should cover, and the intended purpose.
                    </p>

                  </section>

                  {/* 2 */}

                  <section style={{ marginBottom: '24px' }}>

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1C211E',
                      }}
                    >
                      2. Mention the required sections
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#687169',
                      }}
                    >
                      Specify the sections you want, such as
                      Purpose, Scope, Responsibilities, Definitions,
                      Procedure, Acceptance Criteria, Documentation,
                      Risks, and Conclusion.
                    </p>

                  </section>

                  {/* 3 */}

                  <section style={{ marginBottom: '24px' }}>

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1C211E',
                      }}
                    >
                      3. Specify your sources
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#687169',
                      }}
                    >
                      Tell BioBridge whether the answer should use
                      uploaded reference documents, internet research,
                      or both.
                    </p>

                  </section>

                  {/* 4 */}

                  <section style={{ marginBottom: '24px' }}>

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1C211E',
                      }}
                    >
                      4. Mention regulations or standards
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#687169',
                      }}
                    >
                      Where applicable, mention FDA, EMA, ICH,
                      WHO, USP, ISO, GMP, or other relevant standards
                      and guidelines.
                    </p>

                  </section>

                  {/* 5 */}

                  <section style={{ marginBottom: '24px' }}>

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1C211E',
                      }}
                    >
                      5. Example of a good prompt
                    </h3>

                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: '#F1F3EF',
                        border: '1px solid #D9DDD7',
                        borderRadius: '8px',
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#46504A',
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

                  <section style={{ marginBottom: '24px' }}>

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1C211E',
                      }}
                    >
                      6. For better technical documents
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#687169',
                      }}
                    >
                      Mention the expected level of detail, target
                      audience, applicable regulations, required
                      acceptance criteria, equipment or process details,
                      and any specific company requirements.
                    </p>

                  </section>

                  {/* 7 */}

                  <section style={{ marginBottom: '24px' }}>

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1C211E',
                      }}
                    >
                      7. Always review the final document
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#687169',
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
                      borderTop: '1px solid #D9DDD7',
                      paddingTop: '16px',
                    }}
                  >

                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        lineHeight: 1.5,
                        color: '#687169',
                      }}
                    >

                      <span
                        style={{
                          color: '#1C211E',
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