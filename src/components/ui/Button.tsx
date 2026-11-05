export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1 rounded-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const sizes: Record<ButtonSize, string> = { sm: "px-2.5 py-1 text-[13px]", md: "px-3.5 py-1.5 text-sm" };
const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-deep",
  secondary: "border border-rule-strong bg-surface text-ink hover:border-brand hover:text-brand",
  danger: "border border-transparent text-absent hover:bg-absent-soft",
  quiet: "text-brand hover:bg-brand-soft",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return `${base} ${sizes[size]} ${variants[variant]}`;
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = "primary", size = "md", className = "", ...rest }: Props) {
  return <button {...rest} className={`${buttonClass(variant, size)} ${className}`} />;
}
