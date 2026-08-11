import { BaseEdge, type EdgeProps, getSmoothStepPath } from "@xyflow/react"
import { CORNER_RADIUS } from "@/lib/layout/constants"

/**
 * The line from a couple down to one of their children.
 *
 * Only exists to put the horizontal run where the *layout* says, rather than
 * where React Flow would default to. `smoothstep` bends at the midpoint between
 * the two handles, which means every union on a row draws its sibling bar on the
 * same line — fine until two families' bars overlap, at which point they merge
 * into one stroke and there is no way to tell which end belongs to whom.
 *
 * `lib/layout/family.ts` assigns each bar a lane and hands the resulting y down
 * as `busY`; `centerY` is the one parameter that puts it there. Every edge out
 * of the same union gets the same value, so they still overlay into a single
 * bar — which is the whole point of union nodes.
 *
 * Falls back to the default midpoint when `busY` is absent, so an edge that
 * predates the lane pass still draws.
 */
export function DescentEdge({
	sourceX,
	sourceY,
	sourcePosition,
	targetX,
	targetY,
	targetPosition,
	data,
	style,
	markerEnd,
}: EdgeProps) {
	const busY = typeof data?.busY === "number" ? data.busY : undefined

	const [path] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		borderRadius: CORNER_RADIUS,
		...(busY === undefined ? {} : { centerY: busY }),
	})

	return <BaseEdge path={path} style={style} markerEnd={markerEnd} />
}
