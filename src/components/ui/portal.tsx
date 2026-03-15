"use client";

import { createPortal } from "react-dom";

interface PortalProps {
    children: React.ReactNode;
}

export function Portal({ children }: PortalProps) {
    if (typeof document === "undefined") {
        return null;
    }

    return createPortal(children, document.body);
}
