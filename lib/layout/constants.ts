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

/**
 * Vertical distance between generations in the family view.
 *
 * This has to hold the sibling bars, not just separate the rows. At 76 the
 * midpoint of the drop landed about 5px under the cards, so every horizontal run
 * hugged the row above it and two families' runs were told apart only by which
 * pixel they were on. The gap now has room for a band of bars beneath the cards
 * with clear air on both sides.
 */
export const GENERATION_GAP = 116

/**
 * Where a union's sibling bar sits, measured up from the top of the children's
 * row, and how far apart two bars are stacked when they would otherwise overlap.
 *
 * Anchoring to the children rather than to the midpoint is what keeps the bars
 * in a consistent band: a reader following a line down finds every bar at the
 * same height above the cards it feeds, whatever the generation.
 */
export const DESCENT_BUS_INSET = 46
export const DESCENT_LANE_STEP = 15

/**
 * Corner radius where a descent line turns into the sibling bar. Lives here
 * rather than in the canvas because the custom descent edge needs it too, and
 * two copies would drift.
 */
export const CORNER_RADIUS = 14

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
