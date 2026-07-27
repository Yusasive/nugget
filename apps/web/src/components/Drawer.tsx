import { useEffect, useRef, type ReactNode } from "react";

/**
 * Side drawer for data-entry that would otherwise displace the list behind it
 * (ui-ux.md §5: "so staff don't lose their place in the underlying
 * list/board"). Motion is deliberately restrained per §10.
 */
export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Called from the effect below without being a dependency of it, so typing
  // in a form field (which re-renders the parent and gives `onClose` a new
  // identity every keystroke) can't retrigger the open/focus-trap setup and
  // steal focus back to the close button mid-keystroke.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current
      ?.querySelector<HTMLElement>(".drawer-body input, .drawer-body select, .drawer-body textarea")
      ?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Keep Tab inside the drawer while it owns the screen (§9: keyboard navigable).
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose is read via onCloseRef, deliberately not a dependency (see comment above)
  }, [open]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}
