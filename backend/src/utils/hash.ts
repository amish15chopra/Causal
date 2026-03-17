import crypto from 'crypto';

/**
 * Generates a stable, deterministic, short ID for a graph node based on text and an optional parent ID.
 * This ensures that identical (text, parentId) pairs always yield the same hash,
 * preserving graph integrity across regenerations.
 *
 * @param {string} text - The content or label of the node.
 * @param {string} [parentId] - The optional parent node ID to distinguish duplicate text in different branches.
 * @returns {string} A base64 URL-safe short version of the SHA-256 hash.
 *
 * @example
 * // Tests:
 * // const id1 = generateNodeId("inflation rises");
 * // const id2 = generateNodeId("inflation rises");
 * // console.assert(id1 === id2, "Same text should produce the same ID");
 * //
 * // const id3 = generateNodeId("inflation rises", "parent-123");
 * // const id4 = generateNodeId("inflation rises", "parent-123");
 * // console.assert(id3 === id4, "Same text + parent should produce the same ID");
 * // console.assert(id1 !== id3, "Providing a parentId should change the ID");
 */
export function generateNodeId(text: string, parentId?: string): string {
  const input = text + (parentId || '');
  return crypto
    .createHash('sha256')
    .update(input)
    .digest('base64url') // base64url is URL-safe and compact
    .slice(0, 16); // Short version
}
