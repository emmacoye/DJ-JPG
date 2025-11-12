import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

type Variant = "primary" | "secondary";

type ButtonProps = PropsWithChildren<
  {
    href: string;
    variant?: Variant;
  } & AnchorHTMLAttributes<HTMLAnchorElement>
>;

const baseStyles =
  "rounded-full px-8 py-3 font-medium transition inline-flex items-center justify-center";

const variantStyles: Record<Variant, string> = {
  primary: "bg-sky-400 text-slate-950 hover:bg-sky-300",
  secondary:
    "border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white",
};

export function Button({
  href,
  children,
  variant = "primary",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <a
      href={href}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}

