/**
 * @tnfronte/react-adapter
 *
 * Framework adapter for React (JSX / TSX).
 *
 * OID Injection:
 *   Uses @babel/parser → @babel/traverse to find every JSXOpeningElement
 *   and prepend a data-oid attribute whose value is a deterministic hash of
 *   (filePath, startLine, startCol).
 *
 * Code Modification:
 *   Locates the JSXOpeningElement bearing the matching data-oid, then
 *   applies the requested CodeAction (style change, prop change, etc.)
 *   Uses recast to preserve formatting.
 */
