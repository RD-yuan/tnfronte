/**
 * @tnfronte/code-mod
 *
 * Code Modification Engine — receives CodeActions from the editor UI,
 * locates the target AST node via OID mapping, transforms the AST,
 * formats the result with Prettier, and writes the file back to disk.
 *
 * Uses recast internally to preserve original formatting and minimise
 * Git diffs.
 */
