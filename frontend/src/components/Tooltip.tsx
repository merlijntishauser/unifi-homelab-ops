interface TooltipProps {
  text: string;
  align?: "center" | "right";
}

export default function Tooltip({ text, align = "center" }: TooltipProps) {
  const position = align === "right"
    ? "right-0"
    : "left-1/2 -translate-x-1/2";

  return (
    <div
      className={`absolute top-full ${position} mt-1.5 px-2.5 py-1.5 rounded-lg bg-ui-text dark:bg-noc-raised text-[11px] text-white dark:text-noc-text whitespace-pre opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-transparent dark:border-noc-border shadow-lg`}
      role="tooltip"
    >
      {text}
    </div>
  );
}
