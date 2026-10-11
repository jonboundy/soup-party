"use client"

import * as React from "react"

import { signInHost } from "@/app/host/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { HostSignInState } from "@/lib/host-form"

function HostSignInForm() {
  const [state, formAction, pending] = React.useActionState<
    HostSignInState,
    FormData
  >(signInHost, { status: "idle" })
  const password = React.useRef<HTMLInputElement>(null)

  // React clears the field once the action has run, so it is ready to retype.
  React.useEffect(() => {
    if (state.status !== "idle") password.current?.focus()
  }, [state])

  const incorrect = state.status === "incorrect"

  return (
    <form action={formAction} className="max-w-md">
      {/* Password managers file a saved password under a username. */}
      <input type="text" name="username" value="host" autoComplete="username" readOnly hidden />
      <FieldGroup className="gap-7">
        <Field data-invalid={incorrect}>
          <FieldLabel htmlFor="host-password">Password</FieldLabel>
          <Input
            ref={password}
            id="host-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={incorrect}
            aria-describedby={incorrect ? "host-password-error" : undefined}
          />
          {incorrect && (
            <FieldError id="host-password-error">That password is not correct.</FieldError>
          )}
        </Field>
        {state.status === "rate-limited" && (
          <Alert variant="destructive">
            <AlertTitle>Please wait before trying again.</AlertTitle>
            <AlertDescription>Try again in {Math.ceil(state.retryAfter / 60)} {state.retryAfter > 60 ? "minutes" : "minute"}.</AlertDescription>
          </Alert>
        )}
        {state.status === "unavailable" && (
          <Alert variant="destructive">
            <AlertTitle>Host sign-in is not available.</AlertTitle>
            <AlertDescription>No host password is configured here.</AlertDescription>
          </Alert>
        )}
        {state.status === "failed" && (
          <Alert variant="destructive">
            <AlertTitle>The password could not be checked.</AlertTitle>
            <AlertDescription>Try again.</AlertDescription>
          </Alert>
        )}
        <div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Signing in" : "Sign in"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

export { HostSignInForm }
