/**
 * @tnfronte/oid-index
 *
 * Manages the OID → source-location mapping table.
 *
 * When the Vite/Webpack plugin injects data-oid attributes, the
 * resulting mappings are stored here so the Code Mod Engine can
 * look up any OID and find its source file + AST location.
 */
