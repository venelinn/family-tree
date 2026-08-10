"use client"

import { Search, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useMemo, useRef, useState } from "react"
import type { Person } from "@/lib/family-graph"
import { Avatar } from "./Avatar"

/**
 * Find a person by name.
 *
 * Two jobs, deliberately one component: jumping the chart to someone from the
 * toolbar, and picking the other party when linking two people who are already
 * in the tree. They are the same interaction — "which of these hundreds of
 * people do you mean" — and a second implementation would drift.
 *
 * Matching folds case and diacritics, and searches the married name as well as
 * the name at birth: someone looking for "Tasheva" should find her whether or
 * not that is the name on her card.
 */

/** Case- and accent-insensitive, so `Йорданка` matches `йорданка`. */
const fold = (value: string) =>
	value
		.toLocaleLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")

/** Enough to choose from; more than this and the answer is "type more". */
const LIMIT = 8

interface PersonSearchProps {
	people: Person[]
	onPick: (personId: string) => void
	/** Never offered as a result — you can't relate someone to themselves. */
	excludeId?: string
	placeholder?: string
	autoFocus?: boolean
}

export function PersonSearch({
	people,
	onPick,
	excludeId,
	placeholder,
	autoFocus,
}: PersonSearchProps) {
	const t = useTranslations("search")
	const listId = useId()
	const inputRef = useRef<HTMLInputElement>(null)
	const [query, setQuery] = useState("")
	const [active, setActive] = useState(0)

	const results = useMemo(() => {
		const needle = fold(query.trim())
		if (!needle) return []

		return (
			people
				.filter((person) => {
					if (person.id === excludeId) return false
					return [person.name, person.surname, person.marriedName].some(
						(value) => value && fold(value).includes(needle),
					)
				})
				// Someone whose name *starts* with what you typed is more likely the
				// one you meant than someone it merely appears inside.
				.sort((a, b) => {
					const aStarts = fold(a.name).startsWith(needle) ? 0 : 1
					const bStarts = fold(b.name).startsWith(needle) ? 0 : 1
					return aStarts - bStarts || a.name.localeCompare(b.name)
				})
				.slice(0, LIMIT)
		)
	}, [people, query, excludeId])

	const choose = (person: Person) => {
		onPick(person.id)
		setQuery("")
		setActive(0)
	}

	const years = (person: Person) =>
		[person.birthYear, person.deathYear].some(Boolean)
			? `${person.birthYear ?? ""}–${person.deathYear ?? ""}`
			: undefined

	return (
		<div className="relative">
			<Search
				size={14}
				strokeWidth={2}
				className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 text-ink-faint"
			/>
			<input
				ref={inputRef}
				// biome-ignore lint/a11y/noAutofocus: only set by the link picker, which opens on a click
				autoFocus={autoFocus}
				type="search"
				role="combobox"
				aria-expanded={results.length > 0}
				aria-controls={listId}
				aria-label={t("label")}
				value={query}
				placeholder={placeholder ?? t("placeholder")}
				onChange={(event) => {
					setQuery(event.target.value)
					setActive(0)
				}}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown") {
						event.preventDefault()
						setActive((current) => Math.min(current + 1, results.length - 1))
					} else if (event.key === "ArrowUp") {
						event.preventDefault()
						setActive((current) => Math.max(current - 1, 0))
					} else if (event.key === "Enter" && results[active]) {
						event.preventDefault()
						choose(results[active])
					} else if (event.key === "Escape") {
						setQuery("")
						inputRef.current?.blur()
					}
				}}
				className="w-56 rounded-lg border border-line bg-panel py-1.5 pr-7 pl-8 text-ink text-sm outline-none placeholder:text-ink-faint focus:border-line-strong"
			/>
			{query ? (
				<button
					type="button"
					onClick={() => {
						setQuery("")
						inputRef.current?.focus()
					}}
					aria-label={t("clear")}
					className="-translate-y-1/2 absolute top-1/2 right-2 rounded p-0.5 text-ink-faint hover:text-ink"
				>
					<X size={13} strokeWidth={2} />
				</button>
			) : null}

			{query.trim() ? (
				<ul
					id={listId}
					className="absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-line bg-panel py-1 shadow-lg"
				>
					{results.length === 0 ? (
						<li className="px-3 py-2 text-ink-faint text-sm">
							{t("noResults")}
						</li>
					) : (
						results.map((person, index) => (
							<li key={person.id}>
								<button
									type="button"
									// The list is driven by the keyboard, so hovering has to move
									// the selection too or the two disagree about what Enter does.
									onMouseEnter={() => setActive(index)}
									onMouseDown={(event) => {
										// `mousedown` rather than `click`: the input's blur would
										// otherwise close the list before the click landed.
										event.preventDefault()
										choose(person)
									}}
									className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left ${
										index === active ? "bg-muted" : ""
									}`}
								>
									<Avatar person={person} size={26} />
									<span className="min-w-0 flex-1">
										<span className="block truncate text-ink text-sm">
											{person.name}
										</span>
										{person.marriedName &&
										person.marriedName !== person.surname ? (
											<span className="block truncate text-ink-faint text-xs">
												{person.marriedName}
											</span>
										) : null}
									</span>
									{years(person) ? (
										<span className="shrink-0 text-ink-faint text-xs tabular-nums">
											{years(person)}
										</span>
									) : null}
								</button>
							</li>
						))
					)}
				</ul>
			) : null}
		</div>
	)
}
