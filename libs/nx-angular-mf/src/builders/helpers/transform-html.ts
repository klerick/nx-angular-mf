import { parse, serialize, parseFragment } from 'parse5';

import { getDataForImportMap } from './utils';
import { ConfigMf } from '../types';
import { getResultImportMap } from './init-import-map-utils';
import { PREF } from '../custom-loader/constants';

function findBody(node) {
  let bodyNode = null;
  const innerFunction = (node) => {
    if (!node.childNodes) return;

    for (const child of node.childNodes) {
      if (child.tagName === 'body') {
        bodyNode = child;
        break;
      }
      innerFunction(child);
    }
  };
  innerFunction(node);
  return bodyNode;
}

function fixModulepreloadLinks(node, importMap: Record<string, string>) {
  const cleanKeys = Object.keys(importMap).map((key) => key.replace(PREF, ''));

  const innerFunction = (node) => {
    if (!node.childNodes) return;

    for (const child of node.childNodes) {
      const isPreloadLink =
        child['tagName'] === 'link' &&
        child['attrs']?.some(
          (attr) => attr.name === 'rel' && attr.value === 'modulepreload'
        );

      if (isPreloadLink) {
        const hrefAttr = child['attrs'].find((attr) => attr.name === 'href');
        if (hrefAttr) {
          const matchedKey = cleanKeys.find((key) => hrefAttr.value.endsWith(key));
          if (matchedKey) {
            // Use bare specifier - browser will resolve via import map
            hrefAttr.value = importMap[matchedKey];
          }
        }
      }

      innerFunction(child);
    }
  };

  innerFunction(node);
}

function removeScriptModules(node) {
  const scriptModules = [];
  let bodyNode = null;
  let firstModulepreloadIndex = -1;

  const innerFunction = (node) => {
    if (!node.childNodes) return;

    node.childNodes = node.childNodes.filter((child) => {
      const isModuleScript =
        child['tagName'] === 'script' &&
        (child['attrs'] || []).some(
          (attr) => attr.name === 'type' && attr.value === 'module'
        );

      if (child.tagName === 'body') {
        bodyNode = child;
        firstModulepreloadIndex = child.childNodes.findIndex(
          (c) =>
            c['tagName'] === 'link' &&
            c['attrs']?.some((attr) => attr.name === 'rel' && attr.value === 'modulepreload')
        );
      }

      if (isModuleScript) {
        scriptModules.push(child);
      }
      return !isModuleScript;
    });
    for (const child of node.childNodes) {
      innerFunction(child);
    }
  };

  innerFunction(node);

  return { scriptModules, bodyNode, firstModulepreloadIndex };
}

export async function indexHtml(
  mfeConfig: ConfigMf,
  isDev = false
): Promise<(input: string) => Promise<string>> {
  return async (input: string) => {
    const dataImport = getDataForImportMap(mfeConfig, isDev);
    const allImportMap = await getResultImportMap(dataImport);
    mfeConfig.allImportMap = allImportMap;
    const importMapStr = JSON.stringify(allImportMap);

    const importScriptElement = {
      nodeName: 'script',
      tagName: 'script',
      attrs: [
        {
          name: 'type',
          value: 'importmap',
        },
      ],
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      childNodes: [
        {
          nodeName: '#text',
          value: importMapStr,
        },
      ],
      parentNode: null,
    };

    const document = parse(input);
    fixModulepreloadLinks(document, allImportMap.imports);
    const { bodyNode, scriptModules, firstModulepreloadIndex } = removeScriptModules(document);

    if (firstModulepreloadIndex >= 0) {
      bodyNode.childNodes.splice(firstModulepreloadIndex, 0, importScriptElement);
    } else {
      bodyNode.childNodes.unshift(importScriptElement);
    }

    bodyNode.childNodes.push(...scriptModules);
    return serialize(document);
  };
}

export function addLinkForReload(input: string) {
  const template = `
  <div>
  <a href="#" id="manualReloadDevServerLink">Manual reload dev server</a>
  <style>
  #manualReloadDevServerLink {
    position:absolute;
    top: 0px;
    left: 50%;
  }
</style>
  <script type="module">
  import('/@vite/client').then(r => {
    document.getElementById('manualReloadDevServerLink').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation()
      r.createHotContext('/').send('reload:manual');
      return false;
    });
  })

</script>
</div>`;

  const linkDiv = parseFragment(template);

  const document = parse(input);
  const bodyNode = findBody(document);
  bodyNode.childNodes.push(...linkDiv.childNodes);
  return serialize(document);
}
