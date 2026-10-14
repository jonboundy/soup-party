import * as React from "react"
import { cn } from "cn"

import { Container } from "@/components/layout/container"

// Two of Jon's other sites. Neither has paid for anything.
const sponsors = [
  { name: "GoochBuddy", href: "https://goochbuddy.netlify.app/" },
  { name: "Opossum Catcher", href: "https://www.jonboundy.com/opossum" },
]

function SponsorLink({ name, href }: (typeof sponsors)[number]) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-sm underline decoration-1 underline-offset-4 transition-colors hover:text-foreground hover:decoration-brand"
    >
      {name}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

function SiteFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      data-slot="site-footer"
      className={cn("border-t", className)}
      {...props}
    >
      <Container className="flex min-h-16 flex-col justify-center gap-1 py-4 text-sm text-muted-foreground sm:min-h-20 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p>© 2026 Soup Party</p>
        <p>
          Sponsored by <SponsorLink {...sponsors[0]} /> and{" "}
          <SponsorLink {...sponsors[1]} />
        </p>
      </Container>
    </footer>
  )
}

export { SiteFooter }
