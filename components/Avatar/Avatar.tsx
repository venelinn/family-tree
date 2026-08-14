"use client"

import clsx from "clsx"
import { useState } from "react"
import { usePersonName } from "@/components/PersonNames"
import type { Person } from "@/lib/family-graph"
import styles from "./Avatar.module.scss"

/**
 * Photo with an initials fallback.
 *
 * The photo URLs in the MyHeritage export are signed and time-limited, so a
 * good number of them now 403. Falling back keeps the chart looking intentional
 * instead of littered with broken-image glyphs.
 *
 * `size` arrives as a number and leaves as a custom property. That is the one
 * sanctioned inline style: the value is a runtime prop, and handing CSS a
 * variable keeps the properties it drives — width, height, and the font size
 * derived from them — declared in the stylesheet where they belong.
 */
export function Avatar({
	person,
	size,
	className,
}: {
	person: Person
	size: number
	className?: string
}) {
	const [failed, setFailed] = useState(false)
	const nameOf = usePersonName()

	const sizing = { "--_avatar-size": `${size}px` } as React.CSSProperties

	if (person.photoUrl && !failed) {
		return (
			// biome-ignore lint/performance/noImgElement: external, unoptimizable host
			<img
				src={person.photoUrl}
				alt=""
				width={size}
				height={size}
				style={sizing}
				className={clsx(styles.avatar, styles["avatar--photo"], className)}
				loading="lazy"
				onError={() => setFailed(true)}
			/>
		)
	}

	// Initials follow the name on screen: "ВН" beside a Cyrillic card, not "VN".
	const initials = nameOf(person)
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0] ?? "")
		.join("")
		.toUpperCase()

	return (
		<div
			style={sizing}
			data-sex={person.sex === "F" ? "female" : "male"}
			className={clsx(styles.avatar, styles["avatar--initials"], className)}
		>
			{initials}
		</div>
	)
}
