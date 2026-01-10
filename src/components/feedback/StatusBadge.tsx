// components/feedback/StatusBadge.tsx
import { colors } from '@/theme/colors';

type Status = 'Met' | 'At Risk' | 'Off Track';

export function StatusBadge({ status }: { status: Status }) {
  const bgColor = {
    'Met': `${colors.low}33`, // green with alpha
    'At Risk': `${colors.medium}33`, // yellow with alpha
    'Off Track': `${colors.high}33`, // red with alpha
  }[status];

  const textColor = {
    'Met': colors.low,
    'At Risk': colors.medium,
    'Off Track': colors.high,
  }[status];

  return (
    <span
      className="px-2 py-1 rounded text-xs"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {status}
    </span>
  );
}
