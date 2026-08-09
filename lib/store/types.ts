/**
 * The editable tree, modelled as rows rather than as a nested document.
 *
 * These three shapes are deliberately what Postgres tables would be — flat
 * records, foreign keys by id, no nesting — so moving from the local file store
 * to Supabase is a matter of implementing `TreeStore` against it, not
 * reshaping the data. `FamilyGraph` stays the read model, derived from these.
 */

export type Sex = "M" | "F"

export interface PersonRecord {
	id: string
	fullName: string
	givenName?: string
	surname?: string
	sex: Sex
	/** ISO `1976-12-23` when fully known, otherwise free text like `Jun 1991`. */
	birthDate?: string
	birthPlace?: string
	deathDate?: string
	deathPlace?: string
	/** True when the person is known to have died, even with no date on file. */
	deceased: boolean
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

export interface TreeSnapshot {
	people: PersonRecord[]
	unions: UnionRecord[]
	unionChildren: UnionChildRecord[]
}

export type PersonInput = Omit<PersonRecord, "id" | "updatedAt"> &
	Partial<Pick<PersonRecord, "id">>
export type UnionInput = Omit<UnionRecord, "id" | "updatedAt"> &
	Partial<Pick<UnionRecord, "id">>

/**
 * Everything the app is allowed to do to the tree.
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

	/** Replace everything. Used by the importer, not by the UI. */
	replaceAll(snapshot: TreeSnapshot): Promise<void>
}
