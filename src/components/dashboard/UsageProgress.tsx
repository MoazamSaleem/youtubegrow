interface UsageProgressProps {
  label: string;
  used: number;
  limit: number;
  showUnlimited?: boolean;
}

export function UsageProgress({ label, used, limit, showUnlimited = false }: UsageProgressProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={isAtLimit ? "text-destructive" : isNearLimit ? "text-warning" : "text-foreground"}>
          {used} / {isUnlimited ? "∞" : limit}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isAtLimit
              ? "bg-destructive"
              : isNearLimit
              ? "bg-warning"
              : "bg-primary"
          }`}
          style={{ width: isUnlimited ? "0%" : `${percentage}%` }}
        />
      </div>
    </div>
  );
}
