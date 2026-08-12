/**
 * The editable tree, modelled as rows rather than as a nested document.
 *
 * These shapes are deliberately what Postgres tables would be — flat records,
 * foreign keys by id, no nesting — so moving from the local file store to
 * Supabase is a matter of implementing `TreeStore` against it, not reshaping
 * the data. `FamilyGraph` stays the read model, derived from these.
 */

export type Sex = "M" | "F"

export interface PersonRecord {
	id: string
	fullName: string
	givenName?: string
	/** Surname at birth. For a married woman this is the maiden name. */
	surname?: string
	/**
	 * Family name taken on marriage, when it differs from the one at birth.
	 *
	 * Kept beside `surname` rather than replacing it, because a family tree has
	 * to answer both questions: the name someone was born under is how they
	 * appear in their parents' records, and the name they took is how the rest
	 * of the family knows them. MyHeritage exports it as `_MARNM`.
	 */
	marriedName?: string
	/**
	 * The same person's name written in another language, keyed by locale code:
	 * `{ bg: "Венелин Николов" }`.
	 *
	 * `fullName` stays the one canonical name and is what every language falls
	 * back to — these are alternative spellings of the same person, not a
	 * replacement, so a tree read in a language nobody filled in still shows
	 * everybody. Keyed by plain `string` rather than `Locale` on purpose: a file
	 * written when the app knew a third language must still load when it doesn't.
	 */
	names?: Record<string, string>
	sex: Sex
	/** ISO `1976-12-23` when fully known, otherwise free text like `Jun 1991`. */
	birthDate?: string
	birthPlace?: string
	deathDate?: string
	deathPlace?: string
	/** True when the person is known to have died, even with no date on file. */
	deceased: boolean
	/** Free text about them — the part of a family record that isn't a field. */
	note?: string
	/** Served paths, primary first. */
	photos: string[]
	updatedAt: string
}

export interface UnionRecord {
	id: string
	husbandId?: string
	wifeId?: string
	marriageDate?: string
	marriagePlace?: string
	divorced: boolean
	updatedAt: string
}

/** The join table. Separate row per child so ordering and provenance can grow. */
export interface UnionChildRecord {
	unionId: string
	childId: string
	/** Birth order within the union; ties fall back to birth date. */
	position: number
}

/**
 * What the tree knows about itself.
 *
 * `rootPersonId` lives here rather than in a constant in `lib/data.ts`, and
 * that is what makes more than one tree possible: which person a chart opens on
 * is a property of *that tree*, not of the application. It is also deliberately
 * not a cookie — a cookie is per-browser, and the root person has to survive
 * copying the file to another machine.
 *
 * Optional because a tree started from scratch genuinely has nobody in it yet.
 */
export interface TreeMeta {
	id: string
	name: string
	rootPersonId?: string
	createdAt: string
	updatedAt: string
}

/**
 * A tree as the pickers need it: identity, where it is, and how big it is.
 *
 * `file` and `bundle` are optional because they are properties of a *file*
 * store, and the web target has no files — its trees live in IndexedDB, keyed by
 * id, with no path to show and nothing to convert. Their absence is the signal
 * the UI uses: `TreeManager` hides the path, Move and Open when there is none,
 * rather than testing which platform it is on.
 */
export interface TreeSummary extends TreeMeta {
	/**
	 * Absolute path, for display — "where is my data" has to be answerable.
	 * Undefined for a browser-stored tree, where the honest answer is "in this
	 * browser" rather than a path.
	 */
	file?: string
	/** False when the file has been moved or deleted behind the app's back. */
	available: boolean
	peopleCount: number
	/**
	 * A directory that keeps its photos with it, rather than a loose `.json`
	 * left over from before bundles. Settings offers to convert the ones that
	 * aren't, and uploads are refused until they are. Undefined where the
	 * question does not arise.
	 */
	bundle?: boolean
}

/** The rows alone — what the importer produces and what `replaceAll` takes. */
export interface TreeRows {
	people: PersonRecord[]
	unions: UnionRecord[]
	unionChildren: UnionChildRecord[]
}

export interface TreeSnapshot extends TreeRows {
	meta: TreeMeta
}

export type PersonInput = Omit<PersonRecord, "id" | "updatedAt"> &
	Partial<Pick<PersonRecord, "id">>
export type UnionInput = Omit<UnionRecord, "id" | "updatedAt"> &
	Partial<Pick<UnionRecord, "id">>

/**
 * Everything the app is allowed to do to one tree.
 *
 * Deliberately narrow and mutation-shaped rather than "save the whole tree":
 * a Supabase implementation maps each of these onto one statement, and a
 * full-document write would be impossible to do safely with concurrent editors.
 */
export interface TreeStore {
	read(): Promise<TreeSnapshot>

	createPerson(input: PersonInput): Promise<PersonRecord>
	updatePerson(
		id: string,
		patch: Partial<Omit<PersonRecord, "id" | "updatedAt">>,
	): Promise<PersonRecord>
	/** Also detaches the person from every union they appear in. */
	deletePerson(id: string): Promise<void>

	createUnion(input: UnionInput): Promise<UnionRecord>
	updateUnion(
		id: string,
		patch: Partial<Omit<UnionRecord, "id" | "updatedAt">>,
	): Promise<UnionRecord>
	deleteUnion(id: string): Promise<void>

	addChild(unionId: string, childId: string, position?: number): Promise<void>
	removeChild(unionId: string, childId: string): Promise<void>

	/** The tree's name and root person. */
	updateMeta(
		patch: Partial<Omit<TreeMeta, "id" | "createdAt" | "updatedAt">>,
	): Promise<TreeMeta>

	/** Replace every row, keeping the tree's identity. Used by the importer. */
	replaceAll(rows: TreeRows): Promise<void>
}
