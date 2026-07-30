import { Badge } from "@/components/ui/badge";
import type { Visibility } from "@prisma/client";

const variants: Record<Visibility, "default" | "secondary" | "outline"> = {
  PUBLIC: "default",
  PRIVATE: "secondary",
  TEAM: "outline",
};

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return <Badge variant={variants[visibility]}>{visibility}</Badge>;
}
