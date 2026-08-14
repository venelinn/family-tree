/**
 * A parsed GEDCOM line, with its subordinate lines nested underneath.
 *
 * GEDCOM is a flat, line-oriented format where indentation is expressed as a
 * leading level number:
 *
 *   0 @I85@ INDI
 *   1 NAME Venelin Nikolov /Nikolov/
 *   2 GIVN Venelin Nikolov
 *   1 BIRT
 *   2 DATE 23 DEC 1976
 *
 * `parseGedcomLines` turns that into a tree so the mapper can just walk tags.
 */
export interface GedNode {
	/** `INDI`, `NAME`, `DATE`, … */
	tag: string
	/** Cross-reference id on a record line, e.g. `@I85@`. */
	xref?: string
	/** Everything after the tag; `@F53@` for pointers, free text otherwise. */
	value: string
	children: GedNode[]
}

export const child = (node: GedNode, tag: string): GedNode | undefined =>
	node.children.find((candidate) => candidate.tag === tag)

export const childrenOf = (node: GedNode, tag: string): GedNode[] =>
	node.children.filter((candidate) => candidate.tag === tag)

export const textOf = (node: GedNode, tag: string): string | undefined =>
	child(node, tag)?.value || undefined
