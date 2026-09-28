import { useQuery } from "@tanstack/react-query";
import { FileText, Paperclip, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { chatAttachmentUrl, fmtBytes, type ChatAttachmentRecord } from "../api";
import { requestUseChatAttachment } from "../chatAttachmentBridge";
import { ltr } from "../i18n";
import { m } from "../paraglide/messages.js";
import { listChatAttachmentsQuery } from "../queries/chat";
import { MediaPreview } from "./MediaPreview";
import { WorkspaceEmptyState } from "./WorkspaceEmptyState";
import { Button, IconButton, LoadingRow, showAlert, Spinner } from "./ui";

function addToChat(attachment: ChatAttachmentRecord) {
  const added = requestUseChatAttachment({
    fileName: attachment.fileName,
    displayName: attachment.displayName,
    mediaType: attachment.mediaType,
    size: attachment.size,
  });
  showAlert(
    added ? m.chat_attachments_added() : m.chat_attachments_already_added(),
    added ? "success" : "info",
    { id: `chat-attachment-${attachment.fileName}`, duration: 2000 },
  );
}

export function ChatAttachmentsTab({ projectId }: { projectId: string }) {
  const query = useQuery(listChatAttachmentsQuery(projectId));
  const attachments = query.data?.attachments ?? [];
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = attachments.find((attachment) => attachment.fileName === selectedName) ?? null;

  useEffect(() => {
    if (!attachments.length) {
      setSelectedName(null);
      return;
    }
    if (!selectedName || !attachments.some((attachment) => attachment.fileName === selectedName)) {
      setSelectedName(attachments[0].fileName);
    }
  }, [attachments, selectedName]);

  if (query.isPending) {
    return (
      <div className="files-tab flex h-full min-h-0 bg-background">
        <LoadingRow className="p-5">
          <Spinner /> {m.app_attachments()}
        </LoadingRow>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6 text-subtext" role="alert">
        <p>{query.error instanceof Error ? query.error.message : String(query.error)}</p>
        <Button onClick={() => void query.refetch()}>{m.app_retry()}</Button>
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <WorkspaceEmptyState
        icon={Paperclip}
        title={m.chat_attachments_empty()}
        description={m.chat_attachments_empty_hint()}
      />
    );
  }

  return (
    <div className="files-tab flex h-full min-h-0 bg-background">
      <div className="flex w-64 shrink-0 flex-col min-h-0 border-e border-e-border-variant bg-background">
        <div className="file-tree min-h-0 flex-1 overflow-y-auto py-1.5 text-sm">
          {attachments.map((attachment) => {
            const active = attachment.fileName === selected?.fileName;
            const pdf = attachment.mediaType === "application/pdf";
            return (
              <div
                key={attachment.fileName}
                className={`group flex items-center gap-2 px-2 ${active ? "bg-surface" : ""}`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-start text-text hover:bg-surface"
                  aria-current={active ? "true" : undefined}
                  onClick={() => setSelectedName(attachment.fileName)}
                  onDoubleClick={() => addToChat(attachment)}
                >
                  {pdf ? (
                    <FileText size={16} className="shrink-0 text-muted" />
                  ) : (
                    <img
                      src={chatAttachmentUrl(attachment.fileName)}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-sm border border-border object-cover"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate" title={attachment.displayName}>{ltr(attachment.displayName)}</span>
                    <span className="block truncate text-xs text-subtext">
                      {attachment.sessionTitle
                        ? m.chat_attachments_from({ title: ltr(attachment.sessionTitle) })
                        : fmtBytes(attachment.size)}
                    </span>
                  </span>
                </button>
                <IconButton
                  size="small"
                  className="shrink-0"
                  title={m.chat_attachments_add()}
                  aria-label={m.chat_attachments_add()}
                  onClick={() => addToChat(attachment)}
                >
                  <Plus size={14} />
                </IconButton>
              </div>
            );
          })}
        </div>
      </div>
      {selected ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-text" title={selected.displayName}>
              {ltr(selected.displayName)}
            </span>
            <span className="shrink-0 text-xs text-subtext">{fmtBytes(selected.size)}</span>
            <Button size="small" onClick={() => addToChat(selected)}>
              <Plus size={14} />
              {m.chat_attachments_add()}
            </Button>
          </div>
          <MediaPreview
            kind={selected.mediaType === "application/pdf" ? "pdf" : "image"}
            url={chatAttachmentUrl(selected.fileName)}
            name={selected.displayName}
          />
        </div>
      ) : null}
    </div>
  );
}
