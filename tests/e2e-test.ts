/**
 * e2e-test.ts
 *
 * End-to-end verification script.
 * Tests the full data flow:
 *
 *   1. OID Injection — inject data-oid into a test React file
 *   2. OID Index — build the mapping table
 *   3. Code Mod — apply a style change via AST
 *   4. Verify — check the modified code contains the expected change
 */

import * as fs from 'fs';
import * as path from 'path';

// Direct relative imports (tsx can't resolve workspace aliases)
import { injectOID } from '../packages/adapters/react-adapter/src/inject-oid';
import { OIDIndex } from '../packages/oid-index/src/oid-index';
import { CodeModEngine } from '../packages/code-mod/src/engine';
import { ReactAdapter } from '../packages/adapters/react-adapter/src/react-adapter';

// ─── Paths ────────────────────────────────────────────────────────────

const FIXTURE_PATH = path.resolve(__dirname, '../test-fixture/src/App.tsx');

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  TNFronte End-to-End Test');
  console.log('═══════════════════════════════════════════════\n');

  // ─── Step 0: Read original source ──────────────────────────────────
  console.log('📂 Reading test fixture:', FIXTURE_PATH);
  const originalSource = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  console.log(`   Source length: ${originalSource.length} chars\n`);

  // ─── Step 1: OID Injection ─────────────────────────────────────────
  console.log('🏷️  Step 1: OID Injection');
  const injectionResult = injectOID(originalSource, FIXTURE_PATH);
  console.log(`   ✅ Injected ${injectionResult.mappings.length} OIDs\n`);

  // Print all mappings
  for (const m of injectionResult.mappings) {
    console.log(
      `   ${m.id}  <${m.tagName}>  @ ${path.basename(m.filePath)}:${m.startLine}  [${m.componentScope}]`,
    );
  }
  console.log();

  // Show injected code lines
  const lines = injectionResult.code.split('\n');
  console.log('   Injected code (lines with data-oid):');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('data-oid')) {
      console.log(`   ${String(i + 1).padStart(3)} | ${lines[i].trim()}`);
    }
  }
  console.log();

  // ─── Step 2: Build OID Index ───────────────────────────────────────
  console.log('🗂️  Step 2: Build OID Index');
  const oidIndex = new OIDIndex();
  oidIndex.updateMappings(FIXTURE_PATH, injectionResult.mappings);
  console.log(`   ✅ Index size: ${oidIndex.size} entries\n`);

  // ─── Step 3: Code Mod — Change button color ───────────────────────
  console.log('🎨 Step 3: Code Mod — Modify Button Style');

  // Find the "Increment" button (first button)
  const buttonOID = injectionResult.mappings.find((m) => m.tagName === 'button');

  if (!buttonOID) {
    console.log('   ❌ Could not find a button element!');
    process.exit(1);
  }

  console.log(`   Target: <button> @ line ${buttonOID.startLine} (oid: ${buttonOID.id})`);

  const codeModEngine = new CodeModEngine(oidIndex);
  codeModEngine.registerAdapter(new ReactAdapter());

  const extractedPropsResult = await codeModEngine.extractEditableProps(buttonOID.id);
  if (!extractedPropsResult.success) {
    console.log('   ❌ Prop extraction failed!');
    process.exit(1);
  }

  const classNameProp = extractedPropsResult.props.find((prop) => prop.name === 'className');
  const onClickProp = extractedPropsResult.props.find((prop) => prop.name === 'onClick');
  const buttonTextProp = extractedPropsResult.props.find((prop) => prop.name === 'children');
  if (!classNameProp || classNameProp.value !== 'btn btn-primary') {
    console.log('   ❌ className prop was not extracted correctly!');
    process.exit(1);
  }
  if (!onClickProp || onClickProp.type !== 'expression') {
    console.log('   ❌ onClick expression was not extracted correctly!');
    process.exit(1);
  }
  if (!buttonTextProp || buttonTextProp.value !== 'Increment') {
    console.log('   ❌ button text was not extracted correctly!');
    process.exit(1);
  }

  console.log('🔎 Step 3: Extract Editable Props');
  console.log(`   ✅ Extracted ${extractedPropsResult.props.length} editable props`);
  console.log(`   className = ${classNameProp.value}`);
  console.log(`   onClick = ${onClickProp.value}\n`);

  console.log('🏷️  Step 4: Code Mod - Modify Button Prop');
  const propResult = await codeModEngine.apply(buttonOID.id, {
    type: 'MODIFY_PROP',
    prop: 'title',
    value: 'Increment counter',
  });

  if (propResult.success) {
    if (!propResult.code.includes('title="Increment counter"')) {
      console.log('   ❌ Prop change was not written into the source');
      process.exit(1);
    }
    console.log('   ✅ Prop modification succeeded\n');
  } else {
    console.log('   ❌ Prop modification failed!');
    process.exit(1);
  }

  const result = await codeModEngine.apply(buttonOID.id, {
    type: 'MODIFY_STYLE',
    prop: 'backgroundColor',
    value: '#10b981',
  });

  if (result.success) {
    console.log('   ✅ Style modification succeeded\n');
    const hasStyleChange =
      result.code.includes("backgroundColor: '#10b981'") ||
      result.code.includes('backgroundColor:"#10b981"');
    if (!hasStyleChange) {
      console.log('   ❌ Style change was not written into the source');
      process.exit(1);
    }
    const modifiedLines = result.code.split('\n');
    for (let i = 0; i < modifiedLines.length; i++) {
      if (modifiedLines[i].includes('#10b981') || modifiedLines[i].includes('backgroundColor')) {
        console.log(`   ${String(i + 1).padStart(3)} | ${modifiedLines[i]}`);
      }
    }

    const modifiedProps = await new ReactAdapter().extractEditableProps(result.code, buttonOID);
    const backgroundColorProp = modifiedProps.find((prop) => prop.name === 'style.backgroundColor');
    if (!backgroundColorProp || backgroundColorProp.value !== '#10b981') {
      console.log('   ❌ Modified inline style was not extracted correctly');
      process.exit(1);
    }

    console.log();
  } else {
    console.log('   ❌ Style modification failed!');
    process.exit(1);
  }

  // ─── Step 4: Code Mod — Change text ────────────────────────────────
  console.log('✏️  Step 4: Code Mod — Change Text Content');

  const h1OID = injectionResult.mappings.find((m) => m.tagName === 'h1');

  if (!h1OID) {
    console.log('   ❌ Could not find h1!');
    process.exit(1);
  }

  console.log(`   Target: <h1> @ line ${h1OID.startLine} (oid: ${h1OID.id})`);

  const textResult = await codeModEngine.apply(h1OID.id, {
    type: 'MODIFY_TEXT',
    value: 'Hello TNFronte!',
  });

  if (textResult.success) {
    console.log('   ✅ Text modification succeeded\n');
    if (!textResult.code.includes('Hello TNFronte!')) {
      console.log('   ❌ Updated text was not written into the source');
      process.exit(1);
    }
    const textLines = textResult.code.split('\n');
    for (let i = 0; i < textLines.length; i++) {
      if (textLines[i].includes('Hello TNFronte')) {
        console.log(`   ${String(i + 1).padStart(3)} | ${textLines[i]}`);
      }
    }
    console.log();
  } else {
    console.log('   ❌ Text modification failed!');
    process.exit(1);
  }

  // ─── Step 5: Code Mod — Delete an element ──────────────────────────
  console.log('🗑️  Step 5: Code Mod — Delete <footer>');

  const footerOID = injectionResult.mappings.find((m) => m.tagName === 'footer');
  if (!footerOID) {
    console.log('   ❌ Could not find footer!');
    process.exit(1);
  }

  const deleteResult = await codeModEngine.apply(footerOID.id, { type: 'DELETE' });

  if (deleteResult.success) {
    const hasFooter = deleteResult.code.includes('<footer');
    console.log(`   ✅ Delete succeeded — <footer> tag in output: ${hasFooter}`);
    if (hasFooter) {
      console.log('   ❌ Footer tag is still present after delete');
      process.exit(1);
    } else {
      console.log('   ✅ Footer completely removed from code');
    }
    console.log();
  } else {
    console.log('   ❌ Delete failed!');
    process.exit(1);
  }

  // ─── Step 6: Verify OID lookup ─────────────────────────────────────
  console.log('🔍 Step 6: OID Index Lookup');
  const lookup = oidIndex.getById(buttonOID.id);
  if (lookup) {
    console.log(`   ✅ Lookup ${buttonOID.id} → ${lookup.tagName} @ line ${lookup.startLine}\n`);
  } else {
    console.log('   ❌ OID lookup failed!\n');
    process.exit(1);
  }

  // ─── Summary ───────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('  ✅ ALL 6 TESTS PASSED');
  console.log('═══════════════════════════════════════════════');
  console.log();
  console.log('  1. OID Injection    ✅ ', injectionResult.mappings.length, 'elements tagged');
  console.log('  2. OID Index        ✅ ', oidIndex.size, 'entries indexed');
  console.log('  3. Style Modify     ✅ backgroundColor → #10b981');
  console.log('  4. Text Modify      ✅ h1 → "Hello TNFronte!"');
  console.log('  5. Delete Element   ✅ footer removed');
  console.log('  6. OID Lookup       ✅ reverse lookup works');
  console.log();
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
