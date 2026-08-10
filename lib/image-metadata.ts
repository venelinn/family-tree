/**
 * Identify an image from its bytes, and strip the metadata out of it.
 *
 * An iPhone photograph carries GPS coordinates, a timestamp and a camera serial
 * that links every photo taken on that device. For a picture of a living
 * relative at home, those coordinates are their address. None of it is visible
 * in the image and all of it travels with the file, so it comes off at the door
 * — see [docs/privacy.md](../docs/privacy.md).
 *
 * **The pixels are never re-encoded.** The usual advice is to decode and write
 * the image back out, which does remove the metadata and also costs a
 * generation of quality every time. These are archival images: a scan of the
 * only surviving photograph of a great-grandparent is not something to run
 * through a lossy encoder for a housekeeping reason. Every format below stores
 * its metadata in discardable envelope structures — JPEG segments, PNG chunks,
 * RIFF chunks, GIF extension blocks — so this walks the container and copies
 * through the parts that carry image data. The compressed pixels come out
 * byte-identical.
 *
 * It also means no image library, which is why this file is a few hundred lines
 * of byte-pushing rather than an import.
 *
 * The type comes from the bytes and never from the upload: `File.type` is the
 * browser's multipart header, which is caller-controlled, and the value decides
 * which parser runs.
 */

export type ImageFormat = "jpeg" | "png" | "webp" | "gif"

/** Extension for a detected format. Not derived from any caller-supplied name. */
export const EXTENSIONS: Record<ImageFormat, string> = {
	jpeg: "jpg",
	png: "png",
	webp: "webp",
	gif: "gif",
}

/** Thrown when the bytes don't parse as the format their header claims. */
export class MalformedImageError extends Error {
	constructor(
		readonly format: ImageFormat,
		detail: string,
	) {
		super(`Malformed ${format}: ${detail}`)
		this.name = "MalformedImageError"
	}
}

const startsWith = (bytes: Uint8Array, signature: number[]) =>
	bytes.length >= signature.length &&
	signature.every((byte, index) => bytes[index] === byte)

const ascii = (bytes: Uint8Array, offset: number, length: number) =>
	Buffer.from(bytes.subarray(offset, offset + length)).toString("latin1")

/**
 * The real format, or undefined if these bytes aren't one we handle.
 *
 * AVIF is deliberately absent. It can carry EXIF in an ISOBMFF `meta` box, and
 * accepting a format whose metadata is passed through unread would be worse
 * than not accepting it at all.
 */
export function sniff(bytes: Uint8Array): ImageFormat | undefined {
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg"
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
		return "png"
	if (
		bytes.length >= 12 &&
		ascii(bytes, 0, 4) === "RIFF" &&
		ascii(bytes, 8, 4) === "WEBP"
	)
		return "webp"
	if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(bytes, 0, 6))) return "gif"
	return undefined
}

/** Strip every metadata structure this format can hide something in. */
export function stripMetadata(
	bytes: Uint8Array,
	format: ImageFormat,
): Uint8Array {
	switch (format) {
		case "jpeg":
			return stripJpeg(bytes)
		case "png":
			return stripPng(bytes)
		case "webp":
			return stripWebp(bytes)
		case "gif":
			return stripGif(bytes)
	}
}

/* -------------------------------------------------------------- JPEG ------ */

/**
 * Which `APPn` segments survive.
 *
 * Not all of them are metadata. `ICC_PROFILE` is what makes the colours right
 * on a wide-gamut display, and `Adobe` carries the colour transform a CMYK scan
 * needs to decode at all — dropping either damages the picture to no privacy
 * end. Everything else in the APP range goes, including Apple's `MPF`, which
 * embeds a second image (the HDR gain map) inside the first.
 */
function keepAppSegment(marker: number, payload: Uint8Array): boolean {
	switch (marker) {
		case 0xe0: // APP0 — JFIF/JFXX: pixel density, no personal data.
			return /^JF(IF|XX)\0/.test(ascii(payload, 0, 5))
		case 0xe2: // APP2 — ICC colour profile only; MPF and friends go.
			return ascii(payload, 0, 12) === "ICC_PROFILE\0"
		case 0xee: // APP14 — Adobe colour transform.
			return ascii(payload, 0, 5) === "Adobe"
		default:
			// APP1 (EXIF, XMP), APP13 (IPTC/Photoshop), and everything unclaimed.
			return false
	}
}

/** Markers that stand alone: no length field, no payload. */
const isStandalone = (marker: number) =>
	marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)

function stripJpeg(bytes: Uint8Array): Uint8Array {
	const out: Uint8Array[] = [bytes.subarray(0, 2)] // SOI
	let offset = 2

	while (offset < bytes.length) {
		if (bytes[offset] !== 0xff)
			throw new MalformedImageError("jpeg", `expected a marker at ${offset}`)

		// A run of 0xFF before a marker is legal padding.
		let cursor = offset
		while (bytes[cursor + 1] === 0xff) cursor++
		const marker = bytes[cursor + 1]
		if (marker === undefined)
			throw new MalformedImageError("jpeg", "truncated marker")

		if (isStandalone(marker)) {
			out.push(bytes.subarray(cursor, cursor + 2))
			offset = cursor + 2
			continue
		}

		// End of image. Anything after it is not part of the picture — some
		// tools park data there — so this is where the copy stops.
		if (marker === 0xd9) {
			out.push(bytes.subarray(cursor, cursor + 2))
			break
		}

		const length = (bytes[cursor + 2] << 8) | bytes[cursor + 3]
		if (length < 2)
			throw new MalformedImageError("jpeg", `bad segment length at ${cursor}`)
		const end = cursor + 2 + length
		if (end > bytes.length)
			throw new MalformedImageError("jpeg", "segment runs past end of file")

		if (marker === 0xda) {
			// Start of scan: the header is followed by entropy-coded data with no
			// length of its own. It runs until the next real marker — 0xFF00 is a
			// stuffed literal and 0xFFD0-D7 are restart markers, both of which are
			// scan data rather than the end of it.
			out.push(bytes.subarray(cursor, end))
			let scan = end
			while (scan < bytes.length - 1) {
				if (bytes[scan] === 0xff) {
					const next = bytes[scan + 1]
					if (next !== 0x00 && next !== 0xff && !(next >= 0xd0 && next <= 0xd7))
						break
				}
				scan++
			}
			if (scan >= bytes.length - 1) {
				out.push(bytes.subarray(end))
				break
			}
			out.push(bytes.subarray(end, scan))
			offset = scan
			continue
		}

		const isApp = marker >= 0xe0 && marker <= 0xef
		const isComment = marker === 0xfe
		const keep =
			!isComment &&
			(!isApp || keepAppSegment(marker, bytes.subarray(cursor + 4, end)))
		if (keep) out.push(bytes.subarray(cursor, end))
		offset = end
	}

	return Buffer.concat(out)
}

/* --------------------------------------------------------------- PNG ------ */

/**
 * Ancillary chunks worth keeping — every one of them changes how the image
 * renders. Anything else lowercase is dropped, so a chunk this code has never
 * heard of is discarded rather than passed through: `eXIf`, `tEXt`, `iTXt`,
 * `zTXt` and `tIME` need no special case, and neither will the next one.
 *
 * The `acTL`/`fcTL`/`fdAT` trio is APNG animation; without them an animated PNG
 * would silently become a still.
 */
const PNG_KEEP_ANCILLARY = new Set([
	"tRNS", // transparency
	"gAMA",
	"cHRM",
	"iCCP",
	"sRGB",
	"sBIT", // colour
	"bKGD",
	"pHYs",
	"hIST",
	"sPLT", // rendering
	"acTL",
	"fcTL",
	"fdAT", // APNG
])

/** Uppercase first letter means critical: the image doesn't decode without it. */
const isCriticalChunk = (type: string) => type[0] === type[0]?.toUpperCase()

function stripPng(bytes: Uint8Array): Uint8Array {
	const out: Uint8Array[] = [bytes.subarray(0, 8)] // signature
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	let offset = 8

	while (offset + 8 <= bytes.length) {
		const length = view.getUint32(offset)
		const type = ascii(bytes, offset + 4, 4)
		const end = offset + 12 + length // length + type + data + crc
		if (end > bytes.length)
			throw new MalformedImageError(
				"png",
				`chunk ${type} runs past end of file`,
			)

		if (isCriticalChunk(type) || PNG_KEEP_ANCILLARY.has(type))
			out.push(bytes.subarray(offset, end))

		offset = end
		// Anything trailing IEND isn't part of the image.
		if (type === "IEND") break
	}

	return Buffer.concat(out)
}

/* -------------------------------------------------------------- WebP ------ */

/** VP8X feature flags, in the byte that follows the chunk header. */
const VP8X_EXIF = 0x08
const VP8X_XMP = 0x04

function stripWebp(bytes: Uint8Array): Uint8Array {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const declared = view.getUint32(4, true) + 8
	const limit = Math.min(declared, bytes.length)

	const chunks: Uint8Array[] = []
	let offset = 12 // "RIFF" + size + "WEBP"

	while (offset + 8 <= limit) {
		const fourcc = ascii(bytes, offset, 4)
		const size = view.getUint32(offset + 4, true)
		// Chunks are padded to an even length; the pad byte isn't counted.
		const end = offset + 8 + size + (size % 2)
		if (offset + 8 + size > bytes.length)
			throw new MalformedImageError("webp", `chunk ${fourcc} runs past end`)

		if (fourcc !== "EXIF" && fourcc !== "XMP ") {
			const chunk = Buffer.from(
				bytes.subarray(offset, Math.min(end, bytes.length)),
			)
			// The extended header advertises which optional chunks are present,
			// and a decoder that trusts it will go looking for one that is no
			// longer there.
			if (fourcc === "VP8X" && chunk.length >= 9)
				chunk[8] &= ~(VP8X_EXIF | VP8X_XMP)
			chunks.push(chunk)
		}

		offset = end
	}

	const body = Buffer.concat(chunks)
	const header = Buffer.from(bytes.subarray(0, 12))
	header.writeUInt32LE(body.length + 4, 4) // "WEBP" + chunks
	return Buffer.concat([header, body])
}

/* --------------------------------------------------------------- GIF ------ */

/**
 * Walk the block structure, dropping comment and plain-text extensions.
 *
 * Application extensions go too, except `NETSCAPE2.0`, which is the one that
 * carries the loop count — without it an animation plays once and stops.
 */
function stripGif(bytes: Uint8Array): Uint8Array {
	const out: Uint8Array[] = []
	let offset = 6 // header

	if (offset + 7 > bytes.length)
		throw new MalformedImageError("gif", "truncated screen descriptor")

	const packed = bytes[offset + 4] ?? 0
	// Global colour table: bit 7 says whether there is one, bits 0-2 its size.
	const globalTable = packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0
	out.push(bytes.subarray(0, offset + 7 + globalTable))
	offset += 7 + globalTable

	/** Sub-blocks run until a zero-length one. Returns the offset past them. */
	const endOfSubBlocks = (start: number): number => {
		let cursor = start
		while (cursor < bytes.length) {
			const size = bytes[cursor] ?? 0
			cursor += 1 + size
			if (size === 0) return cursor
		}
		throw new MalformedImageError("gif", "unterminated sub-block chain")
	}

	while (offset < bytes.length) {
		const introducer = bytes[offset]

		if (introducer === 0x3b) {
			out.push(bytes.subarray(offset, offset + 1)) // trailer
			break
		}

		if (introducer === 0x21) {
			const label = bytes[offset + 1]
			const end = endOfSubBlocks(offset + 2)
			const isNetscape =
				label === 0xff && ascii(bytes, offset + 3, 11) === "NETSCAPE2.0"
			// 0xFE comment, 0xFF application, 0x01 plain text — all carry
			// free-form data and none of them are the picture.
			const drop =
				label === 0xfe || label === 0x01 || (label === 0xff && !isNetscape)
			if (!drop) out.push(bytes.subarray(offset, end))
			offset = end
			continue
		}

		if (introducer === 0x2c) {
			if (offset + 10 > bytes.length)
				throw new MalformedImageError("gif", "truncated image descriptor")
			const flags = bytes[offset + 9] ?? 0
			const localTable = flags & 0x80 ? 3 * 2 ** ((flags & 0x07) + 1) : 0
			// Descriptor, local table, LZW minimum code size, then image data.
			const end = endOfSubBlocks(offset + 10 + localTable + 1)
			out.push(bytes.subarray(offset, end))
			offset = end
			continue
		}

		throw new MalformedImageError(
			"gif",
			`unknown block 0x${introducer?.toString(16)}`,
		)
	}

	return Buffer.concat(out)
}
