import * as React from "react"
import { cn } from "cn"

function Wordmark({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="wordmark"
      className={cn(
        "inline-flex items-center gap-2 text-base font-semibold tracking-tight",
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" />
      Soup Party
    </span>
  )
}

export { Wordmark }
