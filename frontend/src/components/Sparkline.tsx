interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "#006fff",
  className,
}: SparklineProps) {
  const points = buildPoints(data, width, height);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function buildPoints(data: number[], width: number, height: number): string {
  if (data.length === 0) {
    const mid = height / 2;
    return `0,${mid} ${width},${mid}`;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range === 0) {
    const mid = height / 2;
    return data.map((_, i) => {
      const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
      return `${x},${mid}`;
    }).join(" ");
  }

  const padding = 1;
  const usableHeight = height - padding * 2;

  return data
    .map((v, i) => {
      const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
      const y = padding + usableHeight - ((v - min) / range) * usableHeight;
      return `${x},${y}`;
    })
    .join(" ");
}
