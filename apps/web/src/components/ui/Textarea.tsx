import { InputHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className = "", ...props }, ref) => {
  return <textarea ref={ref} className={`w-full px-3 py-2 bg-bg border border-border rounded text-sm outline-none focus:border-primary ${className}`} {...props} />;
});
