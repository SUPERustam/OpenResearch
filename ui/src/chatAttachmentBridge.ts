/** A chat attachment already on disk, offered again to the open composer. */
export interface SavedChatAttachmentRef {
  fileName: string;
  displayName: string;
  mediaType: string;
  size: number;
}

type UseListener = (attachment: SavedChatAttachmentRef) => boolean;

const listeners = new Set<UseListener>();

export function onUseChatAttachment(fn: UseListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Ask the open composer to attach a file saved by an earlier chat.
 * Returns whether it was newly added. */
export function requestUseChatAttachment(attachment: SavedChatAttachmentRef): boolean {
  let accepted = false;
  for (const listener of listeners) accepted = listener(attachment) || accepted;
  return accepted;
}
