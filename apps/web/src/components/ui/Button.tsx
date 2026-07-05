import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className = "", variant = "primary", ...props }, ref) => {
  const base = "inline-flex items-center justify-center rounded px-3 py-2 text-sm transition";
  const styles = {
    primary: "bg-primary text-white hover:opacity-90",
    ghost: "text-text hover:bg-surface",
    outline: "border border-border hover:border-primary",
  };
  return <button ref={ref} className={`${base} ${styles[variant]} ${className}`} {...props} />;
});
