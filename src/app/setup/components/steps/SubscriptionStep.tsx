"use client";

import { PricingTable } from "@/app/(system-guard)/(protected)/settings/subscriptions/components/PricingTable";
import { StepWrapper } from "../StepWrapper";
import type { SubscriptionPlan } from "@/constants/subscriptions";

interface SubscriptionStepProps {
  onPlanSelected: (plan: SubscriptionPlan) => void;
}

export function SubscriptionStep({ onPlanSelected }: SubscriptionStepProps) {
  return (
    <StepWrapper maxWidth="full">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black tracking-tight">
          Seleccioná tu Plan
        </h2>
        <p className="text-muted-foreground mt-2">
          Elegí la capacidad que necesita tu ecosistema.
        </p>
      </div>
      <PricingTable
        onSelectPlan={(plan) => {
          onPlanSelected(plan);
        }}
      />
    </StepWrapper>
  );
}
