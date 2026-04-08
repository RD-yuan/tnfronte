/**
 * @tnfronte/code-mod
 *
 * Code Modification Engine — the central coordinator that:
 *   1. Receives a CodeAction + OID
 *   2. Looks up the OID in the index to find the file + location
 *   3. Delegates to the correct Framework Adapter
 *   4. Runs Prettier on the result
 *   5. Returns the final code (caller is responsible for writing to disk)
 */

export { CodeModEngine } from './engine';
