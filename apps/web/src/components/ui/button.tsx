import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

/**
 * OpenOMR Button.
 * Varian & ukuran mengikuti docs/components.md §3 dan docs/tailwind_mapping.md §4.3.
 * sm 32 / md 44 / lg 52 — target sentuh minimum 44px dijamin oleh `md` (default).
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-fast select-none outline-none active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-700 text-white shadow-raised hover:bg-brand-800 aria-expanded:bg-brand-800",
        secondary:
          "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 aria-expanded:bg-slate-50",
        ghost:
          "bg-transparent text-brand-700 hover:bg-brand-50 aria-expanded:bg-brand-50",
        danger:
          "bg-rose-600 text-white shadow-raised hover:bg-rose-700 aria-expanded:bg-rose-700",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-label",
        md: "h-11 rounded-md px-4 text-body",
        lg: "h-[52px] rounded-lg px-5 text-body font-bold",
        icon: "size-11 rounded-md",
        "icon-sm": "size-8 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
