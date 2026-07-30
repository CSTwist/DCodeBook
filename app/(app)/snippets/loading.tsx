import { Skeleton } from "@/components/ui/skeleton";

export default function SnippetsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-36 w-full" />))}
      </div>
    </div>
  );
}
