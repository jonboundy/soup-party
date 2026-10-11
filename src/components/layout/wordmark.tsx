import * as React from "react"
import { cn } from "cn"

function Wordmark({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="wordmark"
      className={cn(
        "inline-flex items-center gap-2 text-base font-semibold tracking-tight whitespace-nowrap",
        className
      )}
      {...props}
    >
      {/* Swells slightly when a link wrapping the wordmark is hovered. */}
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full bg-brand transition-transform duration-300 ease-out group-hover/wordmark:scale-125"
      />
      Soup Party
    </span>
  )
}

export { Wordmark }
