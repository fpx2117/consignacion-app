"use client";

import React, { PropsWithChildren, useRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import type { MotionProps } from "motion/react";

import { cn } from "@/lib/utils";

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string;
  iconSize?: number;
  iconMagnification?: number;
  disableMagnification?: boolean;
  iconDistance?: number;
  direction?: "top" | "middle" | "bottom";
  orientation?: "horizontal" | "vertical"; // ✅ nuevo
  children: React.ReactNode;
}

const DEFAULT_SIZE = 40;
const DEFAULT_MAGNIFICATION = 60;
const DEFAULT_DISTANCE = 140;
const DEFAULT_DISABLEMAGNIFICATION = false;

const dockVariants = cva(
  // ✅ sacamos mt-8 y height fija; no hardcodear layout
  "supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 flex w-max items-center justify-center gap-2 rounded-2xl border p-2 backdrop-blur-md"
);

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      iconSize = DEFAULT_SIZE,
      iconMagnification = DEFAULT_MAGNIFICATION,
      disableMagnification = DEFAULT_DISABLEMAGNIFICATION,
      iconDistance = DEFAULT_DISTANCE,
      direction = "middle",
      orientation = "horizontal",
      ...props
    },
    ref
  ) => {
    // ✅ un solo motion value para "la dimensión principal"
    const pointer = useMotionValue(Infinity);

    const renderChildren = () => {
      return React.Children.map(children, (child) => {
        if (React.isValidElement<DockIconProps>(child) && child.type === DockIcon) {
          return React.cloneElement(child, {
            ...child.props,
            pointer,
            size: iconSize,
            magnification: iconMagnification,
            disableMagnification,
            distance: iconDistance,
            orientation,
          });
        }
        return child;
      });
    };

    return (
      <motion.div
        ref={ref}
        onMouseMove={(e) => {
          // ✅ horizontal usa X, vertical usa Y
          pointer.set(orientation === "vertical" ? e.pageY : e.pageX);
        }}
        onMouseLeave={() => pointer.set(Infinity)}
        {...props}
        className={cn(
          dockVariants({ className }),
          {
            "items-start": direction === "top",
            "items-center": direction === "middle",
            "items-end": direction === "bottom",
          }
        )}
      >
        {renderChildren()}
      </motion.div>
    );
  }
);

Dock.displayName = "Dock";

export interface DockIconProps
  extends Omit<MotionProps & React.HTMLAttributes<HTMLDivElement>, "children"> {
  size?: number;
  magnification?: number;
  disableMagnification?: boolean;
  distance?: number;
  pointer?: MotionValue<number>; // ✅ reemplaza mouseX
  orientation?: "horizontal" | "vertical"; // ✅ nuevo
  className?: string;
  children?: React.ReactNode;
  props?: PropsWithChildren;
}

const DockIcon = ({
  size = DEFAULT_SIZE,
  magnification = DEFAULT_MAGNIFICATION,
  disableMagnification,
  distance = DEFAULT_DISTANCE,
  pointer,
  orientation = "horizontal",
  className,
  children,
  ...props
}: DockIconProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const padding = Math.max(6, size * 0.2);
  const defaultPointer = useMotionValue(Infinity);

  const distanceCalc = useTransform(pointer ?? defaultPointer, (val: number) => {
    const el = ref.current;
    if (!el) return Infinity;

    const bounds = el.getBoundingClientRect();

    // ✅ elegimos eje según orientación
    if (orientation === "vertical") {
      const centerY = bounds.y + bounds.height / 2;
      return val - centerY;
    }

    const centerX = bounds.x + bounds.width / 2;
    return val - centerX;
  });

  const targetSize = disableMagnification ? size : magnification;

  const sizeTransform = useTransform(
    distanceCalc,
    [-distance, 0, distance],
    [size, targetSize, size]
  );

  const scaleSize = useSpring(sizeTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  return (
    <motion.div
      ref={ref}
      style={{ width: scaleSize, height: scaleSize, padding }}
      className={cn(
        "flex aspect-square items-center justify-center rounded-full",
        // ✅ hover correcto si no hay magnify
        disableMagnification && "transition-colors hover:bg-muted",
        className
      )}
      {...props}
    >
      <div>{children}</div>
    </motion.div>
  );
};

DockIcon.displayName = "DockIcon";

export { Dock, DockIcon, dockVariants };
