"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { KpiCard } from "./kpi-card";
import { cn } from "@/lib/utils";

export interface KpiConfig {
  key: string;
  title: string;
  value: string;
  subtitle: string;
  formula?: string;
  icon: React.ElementType;
  loading: boolean;
  emphasis?: boolean;
  variant?: "default" | "success" | "destructive" | "warning";
}

export function SortableKpiCard({ kpi }: { kpi: KpiConfig }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: kpi.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative h-full w-full will-change-transform",
        isDragging && "z-40 opacity-80",
      )}
    >
      <button
        type="button"
        aria-label={`Mover KPI ${kpi.title}`}
        className="touch-none absolute right-3 top-3 z-30 inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-md border border-border/70 bg-background/80 text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <KpiCard
        loading={kpi.loading}
        title={kpi.title}
        value={kpi.value}
        subtitle={kpi.subtitle}
        formula={kpi.formula}
        icon={kpi.icon}
        emphasis={kpi.emphasis}
        variant={kpi.variant}
      />
    </div>
  );
}

export function KpiSortableGrid({
  items,
  className,
  onReorder,
}: {
  items: KpiConfig[];
  className: string;
  onReorder: (keys: string[]) => void;
}) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 14 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = React.useMemo(() => items.map((item) => item.key), [items]);
  const activeKpi = React.useMemo(
    () => items.find((item) => item.key === activeId) ?? null,
    [activeId, items],
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || active.id === over.id) return;

      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));

      if (oldIndex < 0 || newIndex < 0) return;

      onReorder(arrayMove(ids, oldIndex, newIndex));
    },
    [ids, onReorder],
  );

  const handleDragCancel = React.useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={cn(className, "items-stretch")}>
          {items.map((kpi) => (
            <SortableKpiCard key={kpi.key} kpi={kpi} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeKpi ? (
          <div className="w-[min(100vw-2rem,420px)] rotate-1 opacity-95">
            <KpiCard
              loading={activeKpi.loading}
              title={activeKpi.title}
              value={activeKpi.value}
              subtitle={activeKpi.subtitle}
              formula={activeKpi.formula}
              icon={activeKpi.icon}
              emphasis={activeKpi.emphasis}
              variant={activeKpi.variant}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
