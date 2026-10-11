import * as React from "react"
import Link from "next/link"
import { cn } from "cn"

import { Container } from "@/components/layout/container"
import { Wordmark } from "@/components/layout/wordmark"

function SiteHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="site-header"
      className={cn(
        "sticky top-0 z-40 bg-background/90 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      <Container className="flex h-(--header-height) items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="-mx-2 rounded-md px-2 py-1.5">
          <Wordmark />
        </Link>
        {children && (
          <nav aria-label="Primary" className="flex items-center sm:gap-1">
            {children}
          </nav>
        )}
      </Container>
    </header>
  )
}

export { SiteHeader }
