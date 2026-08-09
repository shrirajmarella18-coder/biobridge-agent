import { useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { QUICK_ACTIONS } from '@/types/chat';
import { Upload, LogOut, FileUp, CheckCircle2, Menu } from 'lucide-react';

interface SidebarProps {
  onQuickAction: (prompt: string) => void;
  onMenuClose: () => void;
}

type UploadState = 'idle' | 'uploading' | 'success';

export default function Sidebar({ onQuickAction, onMenuClose }: SidebarProps) {
  const { user, signOut, getIdToken } = useAuth();
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const extOk = file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.docx');
    if (!extOk && !allowed.includes(file.type)) {
      setUploadError('Only .pdf and .docx files are accepted.');
      return;
    }

    setUploadError(null);
    setUploadState('uploading');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const accessToken = await getIdToken();
      if (!accessToken) throw new Error('Authentication session expired. Please sign in again.');

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/biobridge/upload`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
          'X-File-Type': file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx',
        },
        body: arrayBuffer,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setUploadState('success');
      setTimeout(() => setUploadState('idle'), 3000);
    } catch {
      setUploadError('Upload failed. Try again.');
      setUploadState('idle');
    }
  }, [getIdToken]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const displayName = user?.displayName ?? 'Engineer';
  const displayEmail = user?.email ?? '';
  const avatarUrl = user?.photoURL;

  return (
    <div className="h-full flex flex-col bg-panel border-r border-hairline">
      {/* Account row */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-hairline">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-8 h-8 rounded-lg" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-panel-active flex items-center justify-center text-xs font-mono text-muted">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-content font-medium truncate">{displayName}</p>
          <p className="text-xs text-muted truncate font-mono">{displayEmail}</p>
        </div>
        <button
          onClick={signOut}
          className="p-2 text-muted hover:text-content transition-colors duration-200 min-w-[40px] min-h-[40px] flex items-center justify-center"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Upload zone */}
      <div className="px-4 py-4 border-b border-hairline">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
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
              <Upload size={20} className="text-muted" />
              <div>
                <p className="text-sm text-content font-medium">Upload reference documents</p>
                <p className="text-xs text-muted mt-0.5 font-mono">.pdf or .docx — drag &amp; drop or click</p>
              </div>
            </div>
          )}

          {uploadState === 'uploading' && (
            <div className="flex flex-col items-center gap-2 text-center">
              <FileUp size={20} className="text-teal animate-pulse-soft" />
              <p className="text-sm text-content font-medium">Uploading &amp; indexing…</p>
            </div>
          )}

          {uploadState === 'success' && (
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 size={20} className="text-teal" />
              <p className="text-sm text-content font-medium">Document indexed</p>
            </div>
          )}
        </div>

        {uploadError && (
          <p className="mt-2 text-xs text-red-400 font-mono">{uploadError}</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <p className="px-2 py-2 text-[11px] uppercase tracking-[0.12em] text-muted font-mono">
          Quick Actions
        </p>
        <div className="flex flex-col gap-0.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                onQuickAction(action.prompt);
                onMenuClose();
              }}
              className="text-left px-3 py-2 text-sm text-muted hover:text-content hover:bg-panel-hover rounded-lg transition-colors duration-200 min-h-[40px]"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile close hint */}
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
  );
}
