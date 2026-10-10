import * as React from "react"
import { cn } from "cn"

import { Container } from "@/components/layout/container"

function SiteFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      data-slot="site-footer"
      className={cn("border-t", className)}
      {...props}
    >
      <Container className="flex h-16 items-center text-sm text-muted-foreground sm:h-20">
        <p>© 2026 Soup Party</p>
      </Container>
    </footer>
  )
}

export { SiteFooter }
