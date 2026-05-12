import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

/**
 * VisuallyHidden component for screen reader only content
 * 
 * Hides content from visual display while keeping it accessible to screen readers.
 * Useful for DialogTitle that should be hidden but still provide context for accessibility.
 * 
 * Can be used with `asChild` prop to render as a different component (e.g., DialogTitle)
 * 
 * @see https://www.w3.org/WAI/tutorials/forms/labels/
 */
interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean
}

const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  VisuallyHiddenProps
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "span"
  
  return (
    <Comp
      ref={ref}
      className={`sr-only ${className || ''}`}
      {...props}
    />
  )
})
VisuallyHidden.displayName = "VisuallyHidden"

export { VisuallyHidden }
