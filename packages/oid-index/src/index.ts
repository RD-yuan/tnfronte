/**
 * @tnfronte/oid-index
 *
 * In-memory mapping table: OID.id → OID record.
 * Updated each time the Vite/Webpack plugin injects data-oid into a file.
 * Queried by the Code Mod Engine to locate source positions.
 */

export { OIDIndex } from './oid-index.ts';
