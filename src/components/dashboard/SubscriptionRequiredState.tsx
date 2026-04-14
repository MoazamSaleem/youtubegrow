import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";

interface SubscriptionRequiredStateProps {
  title?: string;
  description: string;
  ctaLabel?: string;
}

export function SubscriptionRequiredState({
  title = "Active subscription required",
  description,
  ctaLabel = "View Plans",
}: SubscriptionRequiredStateProps) {
  return (
    <div className="w-full text-center py-16">
      <div className="inline-flex p-6 rounded-3xl glass mb-8">
        <Lock className="h-16 w-16 text-muted-foreground" />
      </div>
      <h2 className="font-display text-2xl font-bold mb-4">{title}</h2>
      <p className="text-muted-foreground mb-8 max-w-xl mx-auto">{description}</p>
      <Button variant="hero" asChild>
        <Link to="/dashboard/billing">
          <Sparkles className="h-4 w-4 mr-2" />
          {ctaLabel}
        </Link>
      </Button>
    </div>
  );
}
