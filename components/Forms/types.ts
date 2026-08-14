/**
 * One size scale for every control.
 *
 * A `Button` sitting beside an `Input` has to line up, and it can only do that
 * if both are asked for the same size by the same name. `Button` re-exports this
 * as `ButtonSize`.
 */
export type FormElementSize = "sm" | "md" | "lg"
