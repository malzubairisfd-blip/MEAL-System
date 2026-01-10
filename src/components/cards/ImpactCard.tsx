// components/cards/ImpactCard.tsx
import { colors } from '@/theme/colors';

type ImpactLevel = 'high' | 'medium' | 'low';

interface ImpactCardProps {
  title: string;
  value: string;
  impact: ImpactLevel;
}

export function ImpactCard({ title, value, impact }: ImpactCardProps) {
  const borderColor = {
    high: colors.low, // Met is green
    medium: colors.medium, // At risk is yellow
    low: colors.high, // Off track is red
  }[impact];
  
  return (
    <div
      whileHover={{ scale: 1.01 }}
      className={`
        bg-surface border border-border border-l-4
        rounded-lg p-5
      `}
      style={{ borderLeftColor: borderColor }}
    >
      <p className="text-xs uppercase tracking-widest text-muted mb-2">{title}</p>
      <p className="font-mono text-2xl font-medium">{value}</p>
    </div>
  );
}
