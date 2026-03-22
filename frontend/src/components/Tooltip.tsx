interface TooltipProps {
  text: string;
  align?: "center" | "left" | "right";
}

const alignClass = {
  center: "left-1/2 -translate-x-1/2",
  left: "left-0",
  right: "right-0",
};

export default function Tooltip({ text, align = "center" }: TooltipProps) {
  const position = alignClass[align];

  return (
    <div
      className={`absolute top-full ${position} mt-1.5 px-2.5 py-1.5 rounded-lg bg-ui-text dark:bg-noc-raised text-[11px] text-white dark:text-noc-text whitespace-pre opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-transparent dark:border-noc-border shadow-lg`}
      role="tooltip"
    >
      {text}
    </div>
  );
}
