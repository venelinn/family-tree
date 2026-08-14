"use client"

import { Search, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useMemo, useRef, useState } from "react"
import { Avatar } from "@/components/Avatar"
import { Button } from "@/components/Button"
import { usePersonName } from "@/components/PersonNames"
import type { Person } from "@/lib/family-graph"
import { nameVariants } from "@/lib/person-name"
import styles from "./PersonSearch.module.scss"

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

/** Does any spelling of this person's name begin with what was typed? */
const starts = (person: Person, needle: string) =>
	nameVariants(person).some((value) => fold(value).startsWith(needle))

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
	const nameOf = usePersonName()
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
					// Every spelling on file, not just the one on screen: someone
					// typing "Венелин" must find him while the chart is in English.
					return [
						...nameVariants(person),
						person.surname,
						person.marriedName,
					].some((value) => value && fold(value).includes(needle))
				})
				// Someone whose name *starts* with what you typed is more likely the
				// one you meant than someone it merely appears inside.
				.sort((a, b) => {
					const aStarts = starts(a, needle) ? 0 : 1
					const bStarts = starts(b, needle) ? 0 : 1
					return aStarts - bStarts || nameOf(a).localeCompare(nameOf(b))
				})
				.slice(0, LIMIT)
		)
	}, [people, query, excludeId, nameOf])

	const choose = (person: Person) => {
		onPick(person.id)
		setQuery("")
		setActive(0)
	}

	const years = (person: Person) =>
		[person.birthYear, person.deathYear].some(Boolean)
			? `${person.birthYear ?? ""}–${person.deathYear ?? ""}`
			: undefined

	/**
	 * Each option needs a stable id so `aria-activedescendant` can point at it:
	 * that is how a combobox tells a screen reader which row Enter would take,
	 * without moving focus off the input the user is still typing in.
	 */
	const optionId = (index: number) => `${listId}-option-${index}`

	return (
		<div className={styles.search}>
			<Search size={14} strokeWidth={2} className={styles.search__icon} />
			<input
				ref={inputRef}
				// biome-ignore lint/a11y/noAutofocus: only set by the link picker, which opens on a click
				autoFocus={autoFocus}
				type="search"
				role="combobox"
				aria-expanded={results.length > 0}
				aria-controls={listId}
				aria-autocomplete="list"
				aria-activedescendant={results[active] ? optionId(active) : undefined}
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
				className={styles.search__input}
			/>
			{query ? (
				<Button
					variant="ghost"
					size="sm"
					className={styles.search__clear}
					aria-label={t("clear")}
					icon={<X size={13} strokeWidth={2} />}
					onClick={() => {
						setQuery("")
						inputRef.current?.focus()
					}}
				/>
			) : null}

			{query.trim() ? (
				<ul
					id={listId}
					// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: `ul[role=listbox]` + `li[role=option]` is the structure the WAI-ARIA combobox pattern specifies
					role="listbox"
					className={styles.search__results}
				>
					{results.length === 0 ? (
						// Not an option — there is nothing here to choose.
						<li role="presentation" className={styles.search__empty}>
							{t("noResults")}
						</li>
					) : (
						results.map((person, index) => {
							const lifespan = years(person)
							return (
								// biome-ignore lint/a11y/useFocusableInteractive: focus stays in the input by design — `aria-activedescendant` is what moves the selection, which is the whole point of the pattern
								<li
									key={person.id}
									id={optionId(index)}
									// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: see the listbox above
									role="option"
									aria-selected={index === active}
									className={styles.search__option}
									// The list is driven by the keyboard, so hovering has to move
									// the selection too or the two disagree about what Enter does.
									onMouseEnter={() => setActive(index)}
									onMouseDown={(event) => {
										// `mousedown` rather than `click`: the input's blur would
										// otherwise close the list before the click landed.
										event.preventDefault()
										choose(person)
									}}
								>
									<Avatar person={person} size={26} />
									<span className={styles.search__names}>
										<span className={styles.search__name}>
											{nameOf(person)}
										</span>
										{person.marriedName &&
										person.marriedName !== person.surname ? (
											<span className={styles.search__married}>
												{person.marriedName}
											</span>
										) : null}
									</span>
									{lifespan ? (
										<span className={styles.search__years}>{lifespan}</span>
									) : null}
								</li>
							)
						})
					)}
				</ul>
			) : null}
		</div>
	)
}
