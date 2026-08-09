import type { FamilyGraph, Person, Sex, Union } from "../family-graph"
import { child, childrenOf, type GedNode, textOf } from "./types"

/**
 * Parser for raw GEDCOM 5.5.1 as exported by MyHeritage.
 *
 * Produces exactly the same `FamilyGraph` the JSON export does — the two are the
 * same tree in different clothes — so nothing downstream cares which one the
 * data came from.
 */

/* ------------------------------------------------------------------ *
 * Lines -> tree
 * ------------------------------------------------------------------ */

/** `1 NAME Venelin /Nikolov/` and `0 @I85@ INDI` both match this. */
const LINE = /^(\d+)\s+(?:(@[^@]*@)\s+)?(\S+)(?:\s(.*))?$/

export function parseGedcomLines(text: string): GedNode[] {
	const roots: GedNode[] = []
	// stack[n] is the node currently open at level n.
	const stack: GedNode[] = []

	for (const rawLine of text.split(/\r?\n/)) {
		// The export is UTF-8 with a BOM on the first line.
		const line = rawLine.replace(/^﻿/, "").trimEnd()
		if (!line) continue

		const match = LINE.exec(line)
		if (!match) continue

		const [, levelText, xref, tag, value = ""] = match
		const level = Number(levelText)

		// GEDCOM splits long values across CONT (new line) and CONC (no break).
		if (tag === "CONT" || tag === "CONC") {
			const parent = stack[level - 1]
			if (parent) parent.value += tag === "CONT" ? `\n${value}` : value
			continue
		}

		const node: GedNode = { tag, xref, value, children: [] }
		if (level === 0) {
			roots.push(node)
			stack.length = 0
			stack[0] = node
		} else {
			stack[level - 1]?.children.push(node)
			stack.length = level
			stack[level] = node
		}
	}

	return roots
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

const MONTHS: Record<string, string> = {
	JAN: "01",
	FEB: "02",
	MAR: "03",
	APR: "04",
	MAY: "05",
	JUN: "06",
	JUL: "07",
	AUG: "08",
	SEP: "09",
	OCT: "10",
	NOV: "11",
	DEC: "12",
}

const titleCase = (word: string) =>
	word[0].toUpperCase() + word.slice(1).toLowerCase()

interface ParsedDate {
	/** Set only when the day, month and year are all known. */
	iso?: string
	/** Human-readable fallback for partial or approximate dates. */
	display?: string
	year?: number
}

/**
 * GEDCOM dates are deliberately loose: `23 DEC 1976`, `JUN 1991`, `2012`,
 * `ABT 1910`, `BET 2012 AND 2013`. Only a complete day/month/year becomes an
 * ISO date; anything else keeps a readable form and contributes a year for
 * sorting. Ranges collapse to their first endpoint.
 */
export function parseGedDate(raw: string | undefined): ParsedDate {
	if (!raw) return {}
	const value = raw.trim()
	if (!value) return {}

	const cleaned = value
		.replace(/^(?:ABT|EST|CAL|BEF|AFT|FROM|INT|BET)\s+/i, "")
		.split(/\s+(?:AND|TO)\s+/i)[0]
		.trim()

	const full = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{3,4})$/.exec(cleaned)
	if (full) {
		const month = MONTHS[full[2].slice(0, 3).toUpperCase()]
		if (month) {
			return {
				iso: `${full[3].padStart(4, "0")}-${month}-${full[1].padStart(2, "0")}`,
				year: Number(full[3]),
			}
		}
	}

	const monthYear = /^([A-Za-z]{3,})\s+(\d{3,4})$/.exec(cleaned)
	if (monthYear && MONTHS[monthYear[1].slice(0, 3).toUpperCase()]) {
		return {
			display: `${titleCase(monthYear[1].slice(0, 3))} ${monthYear[2]}`,
			year: Number(monthYear[2]),
		}
	}

	const yearOnly = /^(\d{3,4})$/.exec(cleaned)
	if (yearOnly) return { display: yearOnly[1], year: Number(yearOnly[1]) }

	const anyYear = /\d{4}/.exec(value)
	return { display: value, year: anyYear ? Number(anyYear[0]) : undefined }
}

/* ------------------------------------------------------------------ *
 * Records -> FamilyGraph
 * ------------------------------------------------------------------ */

/** Reads an event block like BIRT/DEAT/MARR. */
function readEvent(node: GedNode | undefined) {
	if (!node) return {}
	const { iso, display, year } = parseGedDate(textOf(node, "DATE"))
	return { date: iso ?? display, year, place: textOf(node, "PLAC") }
}

/** `Venelin Nikolov /Nikolov/` -> `Venelin Nikolov Nikolov`. */
const cleanName = (value: string) =>
	value.replace(/\//g, " ").replace(/\s+/g, " ").trim()

function readPhotos(record: GedNode): string[] {
	const objects = childrenOf(record, "OBJE")
		.map((object) => ({
			file: textOf(object, "FILE"),
			primary: textOf(object, "_PRIM") === "Y",
		}))
		.filter((entry): entry is { file: string; primary: boolean } =>
			Boolean(entry.file),
		)

	// MyHeritage flags the profile photo with _PRIM; surface it first so it
	// becomes the avatar.
	objects.sort((a, b) => Number(b.primary) - Number(a.primary))
	return objects.map((entry) => entry.file)
}

function buildPerson(record: GedNode): Person {
	const name = child(record, "NAME")
	const birth = readEvent(child(record, "BIRT"))
	const death = readEvent(child(record, "DEAT"))
	const photos = readPhotos(record)

	const given = name ? textOf(name, "GIVN") : undefined
	const surname = name ? textOf(name, "SURN") : undefined

	return {
		id: record.xref ?? "",
		name:
			cleanName(name?.value ?? "") ||
			[given, surname].filter(Boolean).join(" ") ||
			"Unknown",
		givenName: given,
		surname,
		sex: (record.value === "F" || textOf(record, "SEX") === "F"
			? "F"
			: "M") as Sex,
		birthDate: birth.date,
		birthYear: birth.year,
		birthPlace: birth.place,
		deathDate: death.date,
		deathYear: death.year,
		deathPlace: death.place,
		// A DEAT or BURI block means deceased even with no date attached.
		deceased: Boolean(child(record, "DEAT") || child(record, "BURI")),
		photoUrl: photos[0],
		photos,
		unionIds: [],
		childOfUnionId: undefined,
	}
}

function buildUnion(record: GedNode): Union {
	const marriage = readEvent(child(record, "MARR"))
	return {
		id: record.xref ?? "",
		husbandId: textOf(record, "HUSB"),
		wifeId: textOf(record, "WIFE"),
		childIds: childrenOf(record, "CHIL")
			.map((node) => node.value)
			.filter(Boolean),
		marriageDate: marriage.date,
		marriageYear: marriage.year,
		marriagePlace: marriage.place,
		divorced: Boolean(child(record, "DIV")),
	}
}

export function parseGedcomText(text: string): FamilyGraph {
	const records = parseGedcomLines(text)

	const people = new Map<string, Person>()
	for (const record of records) {
		if (record.tag !== "INDI" || !record.xref) continue
		people.set(record.xref, buildPerson(record))
	}

	const unions = new Map<string, Union>()
	for (const record of records) {
		if (record.tag !== "FAM" || !record.xref) continue
		const union = buildUnion(record)

		// Drop references to people who aren't in the file, so layout code can
		// assume every id it sees resolves.
		if (union.husbandId && !people.has(union.husbandId))
			union.husbandId = undefined
		if (union.wifeId && !people.has(union.wifeId)) union.wifeId = undefined
		union.childIds = union.childIds.filter((id) => people.has(id))

		if (!union.husbandId && !union.wifeId && union.childIds.length === 0)
			continue
		unions.set(union.id, union)
	}

	// Link from the union side rather than from each person's FAMS/FAMC, so
	// there is one source of truth and the two can't disagree.
	for (const union of unions.values()) {
		for (const spouseId of [union.husbandId, union.wifeId]) {
			const spouse = spouseId ? people.get(spouseId) : undefined
			if (spouse && !spouse.unionIds.includes(union.id)) {
				spouse.unionIds.push(union.id)
			}
		}
		for (const childId of union.childIds) {
			const person = people.get(childId)
			// First union wins: a person is born into exactly one family.
			if (person && !person.childOfUnionId) person.childOfUnionId = union.id
		}
	}

	// Order marriages chronologically so remarriages render left to right in a
	// stable, meaningful order.
	for (const person of people.values()) {
		person.unionIds.sort((a, b) => {
			const yearA = unions.get(a)?.marriageYear ?? Number.POSITIVE_INFINITY
			const yearB = unions.get(b)?.marriageYear ?? Number.POSITIVE_INFINITY
			return yearA - yearB
		})
	}

	return { people, unions }
}
