"use client"

import { useState } from "react"
import type { Person } from "@/lib/family-graph"

/**
 * Photo with an initials fallback.
 *
 * The photo URLs in the MyHeritage export are signed and time-limited, so a
 * good number of them now 403. Falling back keeps the chart looking intentional
 * instead of littered with broken-image glyphs.
 */
export function Avatar({
	person,
	size,
	className = "",
}: {
	person: Person
	size: number
	className?: string
}) {
	const [failed, setFailed] = useState(false)
	const isFemale = person.sex === "F"

	if (person.photoUrl && !failed) {
		return (
			// biome-ignore lint/performance/noImgElement: external, unoptimizable host
			<img
				src={person.photoUrl}
				alt=""
				width={size}
				height={size}
				style={{ width: size, height: size }}
				className={`shrink-0 rounded-full object-cover ${className}`}
				loading="lazy"
				onError={() => setFailed(true)}
			/>
		)
	}

	const initials = person.name
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0] ?? "")
		.join("")
		.toUpperCase()

	return (
		<div
			style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
			className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${
				isFemale
					? "bg-female-solid text-female-ink"
					: "bg-male-solid text-male-ink"
			} ${className}`}
		>
			{initials}
		</div>
	)
}
