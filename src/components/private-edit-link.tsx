"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function PrivateEditLink({ editPath, description }: { editPath: string; description: string }) {
  const input = React.useRef<HTMLInputElement>(null)
  const [copied, setCopied] = React.useState(false)

  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">Save your private edit link.</p>
      <p id="edit-link-description" className="text-sm text-muted-foreground">
        {description}
      </p>
      <Input
        ref={(node) => {
          input.current = node
          if (node) node.value = new URL(editPath, window.location.origin).href
        }}
        aria-label="Private edit link"
        aria-describedby="edit-link-description"
        readOnly
        defaultValue={editPath}
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={async () => {
          // Build from the browser's own origin, never a submitted Host header.
          const url = new URL(editPath, window.location.origin).href
          if (input.current) input.current.value = url
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
          } catch {
            input.current?.focus()
            input.current?.select()
          }
        }}>Copy link</Button>
        <a href={editPath} referrerPolicy="no-referrer" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">
          Edit RSVP
        </a>
      </div>
      <p role="status" className="text-sm text-muted-foreground">{copied ? "Link copied." : ""}</p>
    </div>
  )
}
