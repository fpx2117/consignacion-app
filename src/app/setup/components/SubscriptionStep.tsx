"use client";

import { PricingTable } from "@/app/(system-guard)/(protected)/settings/subscriptions/components/PricingTable";
import type { SubscriptionPlan } from "@/constants/subscriptions";
import { motion } from "motion/react";

interface SubscriptionStepProps {
    onPlanSelected: (plan: SubscriptionPlan) => void;
}

export function SubscriptionStep({ onPlanSelected }: SubscriptionStepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full -mt-10" // Offset spacing to let PricingTable breath
        >
            <PricingTable
                onSelectPlan={(plan, _currency) => {
                    // Ignore currency choice for now, just capture plan for backend
                    onPlanSelected(plan);
                }}
            />
        </motion.div>
    );
}
