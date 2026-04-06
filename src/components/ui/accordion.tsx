"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

const Accordion = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={className} {...props} />
  )
);
Accordion.displayName = "Accordion";

const AccordionItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`border-b border-gray-200 ${className || ""}`} {...props} />
  )
);
AccordionItem.displayName = "AccordionItem";

interface AccordionTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  isOpen?: boolean;
  onToggle?: () => void;
}

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, isOpen, onToggle, ...props }, ref) => (
    <div className="flex">
      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        className={`flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline ${className || ""}`}
        {...props}
      >
        {children}
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  )
);
AccordionTrigger.displayName = "AccordionTrigger";

interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen?: boolean;
}

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, isOpen, ...props }, ref) => (
    <div
      ref={ref}
      className={`overflow-hidden text-sm transition-all ${
        isOpen ? "animate-accordion-down" : "hidden"
      }`}
      {...props}
    >
      <div className={`pb-4 pt-0 ${className || ""}`}>{children}</div>
    </div>
  )
);
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
