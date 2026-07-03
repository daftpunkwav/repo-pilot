import { LayoutHTMLAttributes, forwardRef } from "react";

interface CardProps extends LayoutHTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className = "", ...props }, ref) => {
  return <div ref={ref} className={`bg-surface border border-border rounded-lg ${className}`} {...props} />;
});
