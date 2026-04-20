import * as fs from 'fs';
import * as path from 'path';

import { CodeModEngine } from '../packages/code-mod/src/engine';
import { HtmlAdapter } from '../packages/adapters/html-adapter/src/html-adapter';
import { injectOID } from '../packages/adapters/html-adapter/src/inject-oid';
import { OIDIndex } from '../packages/oid-index/src/oid-index';

const FIXTURE_PATH = path.resolve(__dirname, './fixtures/vanilla/index.html');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const source = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  const adapter = new HtmlAdapter();

  console.log('Testing HTML adapter against fixture:', FIXTURE_PATH);

  const injectionResult = injectOID(source, FIXTURE_PATH);
  assert(injectionResult.mappings.length >= 4, 'Expected multiple HTML elements to receive OIDs');
  assert(
    !injectionResult.mappings.some((mapping) => mapping.tagName === 'script'),
    'Script tags should not be mapped into the canvas',
  );
  assert(
    !injectionResult.mappings.some((mapping) => mapping.tagName === 'link'),
    'Link tags should not be mapped into the canvas',
  );

  const oidIndex = new OIDIndex();
  oidIndex.updateMappings(FIXTURE_PATH, injectionResult.mappings);

  const codeModEngine = new CodeModEngine(oidIndex);
  codeModEngine.registerAdapter(adapter);

  const buttonOID = injectionResult.mappings.find((mapping) => mapping.tagName === 'button');
  const headingOID = injectionResult.mappings.find((mapping) => mapping.tagName === 'h1');
  const paragraphOID = injectionResult.mappings.find((mapping) => mapping.tagName === 'p');
  const footerOID = injectionResult.mappings.find((mapping) => mapping.tagName === 'footer');

  assert(buttonOID, 'Expected a button element in the vanilla fixture');
  assert(headingOID, 'Expected an h1 element in the vanilla fixture');
  assert(paragraphOID, 'Expected a paragraph element in the vanilla fixture');
  assert(footerOID, 'Expected a footer element in the vanilla fixture');

  const propResult = await codeModEngine.extractEditableProps(buttonOID.id);
  assert(propResult.success, 'Expected prop extraction to succeed for button');

  const classProp = propResult.props.find((prop) => prop.name === 'class');
  const onClickProp = propResult.props.find((prop) => prop.name === 'onclick');
  const countProp = propResult.props.find((prop) => prop.name === 'data-count');
  const textProp = propResult.props.find((prop) => prop.name === 'children');

  assert(classProp?.value === 'btn primary', 'Expected class attribute to be extracted');
  assert(onClickProp?.type === 'expression', 'Expected onclick attribute to be treated as an expression');
  assert(countProp?.value === '0', 'Expected data-count attribute to be extracted');
  assert(textProp?.value === 'Increment', 'Expected button text to be extracted');

  const propModifyResult = await codeModEngine.apply(buttonOID.id, {
    type: 'MODIFY_PROP',
    prop: 'title',
    value: 'Increment counter',
  });
  assert(propModifyResult.success, 'Expected attribute modification to succeed');
  assert(
    propModifyResult.code.includes('title="Increment counter"'),
    'Expected title attribute to be written to HTML output',
  );

  const styleModifyResult = await codeModEngine.apply(paragraphOID.id, {
    type: 'MODIFY_STYLE',
    prop: 'backgroundColor',
    value: '#10b981',
  });
  assert(styleModifyResult.success, 'Expected inline style modification to succeed');

  const refreshedMappings = injectOID(styleModifyResult.code, FIXTURE_PATH).mappings;
  const refreshedParagraphOID = refreshedMappings.find((mapping) => mapping.id === paragraphOID.id);
  assert(
    refreshedParagraphOID,
    'Expected paragraph OID to remain stable after serializing modified HTML',
  );

  const updatedParagraphProps = await adapter.extractEditableProps(
    styleModifyResult.code,
    refreshedParagraphOID,
  );
  const backgroundColorProp = updatedParagraphProps.find(
    (prop) => prop.name === 'style.backgroundColor',
  );
  assert(
    backgroundColorProp?.value === '#10b981',
    'Expected updated inline background color to be extracted from HTML output',
  );

  const textModifyResult = await codeModEngine.apply(headingOID.id, {
    type: 'MODIFY_TEXT',
    value: 'Hello Native Canvas!',
  });
  assert(textModifyResult.success, 'Expected text modification to succeed');
  assert(
    textModifyResult.code.includes('Hello Native Canvas!'),
    'Expected heading text to be updated in HTML output',
  );

  const deleteResult = await codeModEngine.apply(footerOID.id, { type: 'DELETE' });
  assert(deleteResult.success, 'Expected delete action to succeed');
  assert(
    !deleteResult.code.includes('<footer'),
    'Expected footer element to be removed from HTML output',
  );

  console.log('HTML adapter checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
