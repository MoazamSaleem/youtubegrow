import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  locked?: boolean;
  requiredPlan?: string;
  children?: ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

export function FeatureCard({
  title,
  description,
  icon,
  locked = false,
  requiredPlan,
  children,
  action,
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-xl p-6 relative ${locked ? "opacity-75" : ""}`}
    >
      {locked && (
        <div className="absolute inset-0 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10 bg-background/60">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-5 w-5 text-warning" />
            <span className="font-semibold">Locked Feature</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Upgrade to {requiredPlan} to unlock
          </p>
          <Button variant="premium" size="sm" asChild>
            <Link to="/dashboard/billing">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Now
            </Link>
          </Button>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-lg bg-secondary">{icon}</div>
        {action && !locked && (
          action.href ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )
        )}
      </div>

      <h3 className="font-display font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      {children}
    </motion.div>
  );
}
