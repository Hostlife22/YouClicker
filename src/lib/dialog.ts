import { create } from "zustand";

type DialogKind = "confirm" | "alert";

type DialogDescriptor = {
  kind: DialogKind;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmOptions = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type AlertOptions = { message: string; title?: string; confirmLabel?: string };

type DialogStore = {
  dialog: DialogDescriptor | null;
  resolve: ((ok: boolean) => void) | null;
  /** Open a confirm dialog; resolves true on confirm, false on cancel/dismiss. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Open an informational dialog; resolves once dismissed. */
  alert: (opts: AlertOptions) => Promise<void>;
  close: (ok: boolean) => void;
};

/**
 * Styled, accessible replacement for the native `window.confirm`/`alert`.
 * Lives in its own store (not the app store) so any component can open a
 * dialog without prop drilling; <DialogHost> renders the active one.
 */
export const useDialog = create<DialogStore>((set, get) => ({
  dialog: null,
  resolve: null,
  confirm: (opts) =>
    new Promise<boolean>((resolve) =>
      set({ dialog: { kind: "confirm", ...opts }, resolve }),
    ),
  alert: (opts) =>
    new Promise<void>((resolve) =>
      set({ dialog: { kind: "alert", ...opts }, resolve: () => resolve() }),
    ),
  close: (ok) => {
    get().resolve?.(ok);
    set({ dialog: null, resolve: null });
  },
}));
