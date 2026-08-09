/** Card and spacing geometry, shared by both layouts and by the card components. */

// Portrait cards: photo on top, text beneath. Narrow matters far more than
// short here — family charts are enormously wider than they are tall, so
// trading height for width buys real horizontal room.
export const CARD_WIDTH = 132
export const CARD_HEIGHT = 140

/** Gap between the two spouses of a couple — deliberately tight so they read as a unit. */
export const SPOUSE_GAP = 28

/**
 * Gap between adjacent sibling subtrees. Deliberately several times SPOUSE_GAP:
 * the contrast between the two is the only thing telling you which pairs of
 * cards are married, once a row holds several couples side by side.
 */
export const SIBLING_GAP = 48

/** Gap between unrelated top-level subtrees. */
export const SUBTREE_GAP = 84

/** Vertical distance between generations in the family view. */
export const GENERATION_GAP = 76

/** The union marker is a small dot the couple and their children connect through. */
export const UNION_SIZE = 10

/*
 * Pedigree view: laid out left-to-right, so "generation" advances along x.
 *
 * Its cards are landscape — photo left, text right. The pedigree stacks a whole
 * generation vertically in one column (8 cards in the fourth), so height is the
 * scarce dimension here, exactly the opposite of the family view where the chart
 * sprawls sideways. Same trade, opposite axis.
 */
export const PEDIGREE_CARD_WIDTH = 200
export const PEDIGREE_CARD_HEIGHT = 76
export const PEDIGREE_COLUMN_GAP = 70
export const PEDIGREE_ROW_GAP = 16

export const ROW_HEIGHT = CARD_HEIGHT + GENERATION_GAP
