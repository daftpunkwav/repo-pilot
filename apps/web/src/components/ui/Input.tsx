import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className = "", ...props }, ref) => {
  return <input ref={ref} className={`w-full px-3 py-2 bg-bg border border-border rounded text-sm outline-none focus:border-primary ${className}`} {...props} />;
});
