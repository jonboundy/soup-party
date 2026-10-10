import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const containerVariants = cva("mx-auto w-full px-5 sm:px-8 lg:px-12", {
  variants: {
    size: {
      default: "max-w-6xl",
      narrow: "max-w-2xl",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

function Container({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof containerVariants>) {
  return (
    <div
      data-slot="container"
      className={cn(containerVariants({ size }), className)}
      {...props}
    />
  )
}

export { Container, containerVariants }
