import * as React from "react"
import Link from "next/link"

import { Container } from "@/components/layout/container"
import { Wordmark } from "@/components/layout/wordmark"

function SiteHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header data-slot="site-header" className={className} {...props}>
      <Container className="flex h-16 items-center justify-between gap-4 sm:h-20">
        <Link href="/" className="-mx-2 rounded-md px-2 py-1.5">
          <Wordmark />
        </Link>
        {children && (
          <nav
            aria-label="Primary"
            className="flex items-center gap-1 sm:gap-2"
          >
            {children}
          </nav>
        )}
      </Container>
    </header>
  )
}

export { SiteHeader }
