import { Skeleton } from "@/components/ui/skeleton";

export function DetailSkeleton() {
    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-64 w-full rounded-2xl" />
            <div className="flex gap-4 overflow-hidden">
                <Skeleton className="h-10 w-32 rounded-lg shrink-0" />
                <Skeleton className="h-10 w-32 rounded-lg shrink-0" />
                <Skeleton className="h-10 w-32 rounded-lg shrink-0" />
            </div>
            <div className="space-y-3">
                 <Skeleton className="h-20 w-full rounded-xl" />
                 <Skeleton className="h-20 w-full rounded-xl" />
                 <Skeleton className="h-20 w-full rounded-xl" />
            </div>
        </div>
    )
}