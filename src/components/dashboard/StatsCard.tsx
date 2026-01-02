import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: LucideIcon;
  index?: number;
}

export function StatsCard({ label, value, change, positive, icon: Icon, index = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="glass rounded-xl p-6 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-lg bg-secondary">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className={`w-3 h-3 rounded-full ${positive ? "bg-success" : "bg-destructive"}`} />
      </div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold">{value}</span>
        <span
          className={`text-sm flex items-center gap-1 ${
            positive ? "text-success" : "text-destructive"
          }`}
        >
          {positive ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          {change}
        </span>
      </div>
    </motion.div>
  );
}
