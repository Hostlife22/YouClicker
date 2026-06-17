import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDialog } from "../lib/dialog";

/**
 * Renders the currently-open dialog (if any) as a modal overlay. Mounted once
 * at the app root. Escape cancels a confirm / dismisses an alert; the overlay
 * click does the same.
 */
export function DialogHost() {
  const { t } = useTranslation();
  const dialog = useDialog((s) => s.dialog);
  const close = useDialog((s) => s.close);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, close]);

  if (!dialog) return null;

  const confirmLabel = dialog.confirmLabel ?? t("app.ok");
  const cancelLabel = dialog.cancelLabel ?? t("app.cancel");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => close(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dialog.title ?? dialog.message}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}
        onClick={(e) => e.stopPropagation()}
      >
        {dialog.title && (
          <h2 className="text-lg font-semibold mb-2 text-[#e63946]">{dialog.title}</h2>
        )}
        <p className="text-sm whitespace-pre-wrap mb-5">{dialog.message}</p>
        <div className="flex justify-end gap-2">
          {dialog.kind === "confirm" && (
            <button onClick={() => close(false)} className="outlined-btn text-sm">
              {cancelLabel}
            </button>
          )}
          <button autoFocus onClick={() => close(true)} className="outlined-btn text-sm">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
