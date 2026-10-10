import * as React from "react"
import { cn } from "cn"

function Section({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="section"
      className={cn("py-16 sm:py-24 lg:py-32", className)}
      {...props}
    />
  )
}

function SectionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="section-header"
      className={cn(
        "mb-10 flex max-w-2xl flex-col gap-3 sm:mb-14 sm:gap-4",
        className
      )}
      {...props}
    />
  )
}

function SectionEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="section-eyebrow"
      className={cn("type-eyebrow text-muted-foreground", className)}
      {...props}
    />
  )
}

function SectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="section-title"
      className={cn("type-title", className)}
      {...props}
    />
  )
}

function SectionDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="section-description"
      className={cn("type-lead text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Section,
  SectionHeader,
  SectionEyebrow,
  SectionTitle,
  SectionDescription,
}
