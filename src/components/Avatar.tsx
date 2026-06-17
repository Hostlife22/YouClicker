import { useState } from "react";

type Props = {
  src: string;
  alt: string;
  size: number;
  rounded?: boolean;
};

export function Avatar({ src, alt, size, rounded = true }: Props) {
  const [errored, setErrored] = useState(false);
  const initials = alt
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const style = {
    width: size,
    height: size,
    background: "#2a2a2a",
    borderRadius: rounded ? "9999px" : "12px",
  } as const;
  if (!src || errored) {
    return (
      <div
        style={style}
        className="flex items-center justify-center text-[#a0a0a0] font-medium"
      >
        {initials || "?"}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className="object-cover"
    />
  );
}
