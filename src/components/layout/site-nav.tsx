import Link from "next/link"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"
import { SoupLinkLabel } from "@/components/layout/soup-link-label"

// The header cannot fit every link beside the wordmark below 360px, so the
// narrowest screens drop Details, which there sits right under the hero's text.
const links = [
  { href: "/#details", label: "Details", className: "max-[359px]:hidden" },
  { href: "/#soups", label: "Soups" },
]

function SiteNav() {
  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "inline-flex h-11 items-center rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:px-3",
            link.className
          )}
        >
          {link.href === "/#soups" ? <SoupLinkLabel /> : link.label}
        </Link>
      ))}
      <Link
        href="/#rsvp"
        className={cn(buttonVariants({ size: "sm" }), "ml-1.5 sm:ml-2")}
      >
        RSVP
      </Link>
    </>
  )
}

export { SiteNav }
