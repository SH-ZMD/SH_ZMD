// 给 markdown 正文里的图片注入 loading=lazy + decoding=async，
// 长文多图时按视口按需加载，减少首屏字节。
const VISIT_KEYS = ['children'];

function visitImages(node: any, handler: (img: any) => void) {
  if (!node || typeof node !== 'object') return;
  if (node.tagName === 'img') handler(node);
  for (const key of VISIT_KEYS) {
    const children = node[key];
    if (Array.isArray(children)) {
      for (const child of children) visitImages(child, handler);
    }
  }
}

export function rehypeLazyImages() {
  return (tree: any) => {
    visitImages(tree, (img) => {
      if (!img.properties) img.properties = {};
      img.properties.loading = 'lazy';
      img.properties.decoding = 'async';
    });
  };
}
