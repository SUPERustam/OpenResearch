import { m } from "../paraglide/messages.js";
import { ltr } from "../i18n";
import { FileTypeIcon } from "./FileTypeIcon";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { ExperimentArtifactFile } from "../experimentArtifacts";
import { tabOpenGestureHandlers, type TabOpenIntent } from "../tabPreview";

/** Portal file list for an experiment's matched artifact subtree. */
export function ExperimentArtifactsMenu({
  triggerRef,
  files,
  pending,
  onOpen,
  onClose,
  subscribeDismiss,
}: {
  triggerRef: RefObject<HTMLElement | null>;
  files: ExperimentArtifactFile[];
  pending: boolean;
  onOpen: (path: string, intent: TabOpenIntent) => void;
  onClose: () => void;
  /** Extra dismiss channel (tree canvas pan/zoom). */
  subscribeDismiss?: (close: () => void) => () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const triggerRect = triggerRef.current?.getBoundingClientRect();
  const [position, setPosition] = useState({
    x: triggerRect?.left ?? 0,
    y: (triggerRect?.bottom ?? 0) + 6,
  });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition({
      x: Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8)),
      y: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 8)),
    });
  }, [triggerRef, files, pending]);

  useEffect(() => {
    const close = () => onCloseRef.current();
    const dismiss = (event: Event) => {
      const target = event.target instanceof Node ? event.target : null;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keydown, true);
    window.addEventListener("resize", close);
    const stopExtra = subscribeDismiss?.(close);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keydown, true);
      window.removeEventListener("resize", close);
      stopExtra?.();
    };
  }, [triggerRef, subscribeDismiss]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={m.tree_view_artifacts()}
      className="option-menu fixed z-100 min-w-56 max-w-80 max-h-80 overflow-y-auto overscroll-contain rounded-md border border-border bg-background p-1 shadow-menu"
      style={{ left: position.x, top: position.y }}
    >
      {pending && files.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted">{m.artifacts_tab_loading()}</div>
      ) : files.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted">{m.tree_view_no_matching_artifacts()}</div>
      ) : (
        files.map((file) => (
          <button
            key={file.path}
            type="button"
            role="menuitem"
            title={m.a11y_artifact_preview({ path: ltr(file.relativePath) })}
            className="model-item flex w-full min-w-0 items-center gap-1.5 rounded-sm px-2 py-1 text-start text-sm text-text transition-[background,color] duration-120 ease-standard hover:bg-surface"
            {...tabOpenGestureHandlers<HTMLButtonElement>((intent) => onOpen(file.path, intent))}
          >
            <FileTypeIcon name={file.name} />
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {file.relativePath}
            </span>
          </button>
        ))
      )}
    </div>,
    document.body,
  );
}
