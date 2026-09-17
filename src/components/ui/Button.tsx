// ปุ่มมาตรฐานของระบบ — มุมโค้ง 4px, สูงอย่างน้อย 44px บนมือถือ (§8)
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary: "bg-royal text-paper border border-royal hover:bg-royal-700",
  secondary: "bg-paper text-royal border border-royal/35 hover:bg-powder",
  ghost: "bg-transparent text-royal border border-transparent hover:bg-powder",
  danger: "bg-paper text-danger border border-danger/50 hover:bg-danger hover:text-paper",
};

export function Button({
  variant = "secondary",
  fullWidth = false,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={[
        "min-h-touch px-4 rounded font-medium transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClass[variant],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
