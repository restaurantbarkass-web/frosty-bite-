import fs from 'fs';
import path from 'path';
import ts from 'typescript';

function getTagName(node, sf) {
  if (!node) return null;
  if (ts.isJsxElement(node)) {
    return node.openingElement.tagName.getText(sf);
  }
  if (ts.isJsxSelfClosingElement(node)) {
    return node.tagName.getText(sf);
  }
  return null;
}

function normalizeTag(name) {
  if (!name) return null;
  if (name === 'motion.div' || name === 'div') return 'div';
  if (name === 'motion.button' || name === 'button') return 'button';
  if (name === 'motion.section' || name === 'section') return 'section';
  if (name === 'motion.header' || name === 'header') return 'header';
  return name;
}

function findElements(sf, filepath) {
  function traverse(node, parentPath = []) {
    let currentChildren = [];
    if (ts.isJsxElement(node)) {
      currentChildren = node.children.filter(c => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c));
    }

    // count sibling types
    const typeCounts = {};
    for (let i = 0; i < currentChildren.length; i++) {
      const child = currentChildren[i];
      const rawTag = getTagName(child, sf);
      const tag = normalizeTag(rawTag);
      if (!tag) continue;
      typeCounts[tag] = (typeCounts[tag] || 0) + 1;
      const nthOfType = typeCounts[tag];
      const childSegment = `${tag}:nth-of-type(${nthOfType})`;
      const newPath = [...parentPath, childSegment];

      if (tag === 'button') {
        const text = child.getText(sf).slice(0, 100).replace(/\s+/g, ' ');
        const line = sf.getLineAndCharacterOfPosition(child.getStart(sf)).line + 1;
        console.log(`${filepath}:${line} | ${newPath.join(' > ')} | ${text}`);
      }

      traverse(child, newPath);
    }
  }

  ts.forEachChild(sf, node => {
    if (ts.isFunctionDeclaration(node) || ts.isVariableStatement(node) || ts.isArrowFunction(node)) {
      // search for return statements
      function findJsx(n) {
        if (ts.isJsxElement(n)) {
          const rawTag = getTagName(n, sf);
          const tag = normalizeTag(rawTag);
          traverse(n, [`${tag}:nth-of-type(1)`]);
        } else {
          ts.forEachChild(n, findJsx);
        }
      }
      findJsx(node);
    }
  });
}

function processDir(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      processDir(full);
    } else if (f.name.endsWith('.tsx')) {
      const content = fs.readFileSync(full, 'utf8');
      const sf = ts.createSourceFile(full, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      findElements(sf, full);
    }
  }
}

processDir('src');
