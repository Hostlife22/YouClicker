import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../store";
import { useDialog } from "../lib/dialog";

type Props = {
  children: ReactNode;
  showFooter?: boolean;
  topRight?: ReactNode;
  topLeft?: ReactNode;
};

export function AppFrame({ children, showFooter = true, topRight, topLeft }: Props) {
  const { t } = useTranslation();
  const setScreen = useApp((s) => s.setScreen);
  const alertDialog = useDialog((s) => s.alert);
  return (
    <div className="h-screen flex flex-col" style={{ background: "#1a1a1a" }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2 text-xs text-[#a0a0a0]">
        <div className="min-w-0">{topLeft}</div>
        <div className="text-center flex-1">Ver. 1.0.0</div>
        <div className="min-w-0 text-right">{topRight}</div>
      </div>
      <div
        className="flex-1 mx-3 mb-2 rounded-xl overflow-hidden"
        style={{ background: "#232323", border: "1px solid #3a3a3a" }}
      >
        {children}
      </div>
      {showFooter && (
        <div
          className="flex items-center justify-between px-4 py-2 mx-3 mb-3 rounded-xl text-sm"
          style={{ background: "#232323", border: "1px solid #3a3a3a" }}
        >
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-[#a0a0a0]">
            <span>✈</span>
            <span>{t("footer.support")}</span>
          </div>
          <div className="flex-1 flex justify-end gap-2">
            <IconButton
              onClick={() => setScreen("settings")}
              label="⚙"
              ariaLabel={t("settings.title")}
            />
            <IconButton
              onClick={() =>
                void alertDialog({
                  title: t("dialogs.aboutTitle"),
                  message: t("dialogs.aboutBody"),
                })
              }
              label="i"
              ariaLabel={t("dialogs.aboutTitle")}
            />
            <IconButton
              onClick={() =>
                void alertDialog({
                  title: t("dialogs.helpTitle"),
                  message: t("dialogs.helpBody"),
                })
              }
              label="?"
              ariaLabel={t("dialogs.helpTitle")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({
  onClick,
  label,
  ariaLabel,
}: {
  onClick: () => void;
  label: string;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm hover:bg-[#2a2a2a]"
      style={{ border: "1.5px solid #e63946", color: "#e63946" }}
    >
      {label}
    </button>
  );
}
