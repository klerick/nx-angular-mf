import {serialize} from 'parse5'

export function findContentWithinLibrary(node, targetTagName, targetAttr) {
  if (!node || !node['childNodes']) return null;

  if (
    node['tagName'] === 'lib-test-shared-library' &&
    (node['attrs'] || []).some(attr => attr.name === 'ngh' && attr.value === '0')
  ) {
    return node['childNodes']
      .filter(child => child.tagName === targetTagName)
      .map(child => serialize(child));
  }

  for (const child of node['childNodes']) {
    const result = findContentWithinLibrary(child, targetTagName, targetAttr);
    if (result) return result;
  }

  return null;
}


export function findAllScripts(node) {
  let scripts = [];

  if (!node || !node.childNodes) return scripts;

  // Проверяем, является ли текущий узел <script>
  if (node.tagName === 'script') {
    scripts.push(node);
  }

  // Рекурсивно обходим дочерние узлы
  for (const child of node.childNodes) {
    scripts = scripts.concat(findAllScripts(child));
  }

  return scripts;
}
