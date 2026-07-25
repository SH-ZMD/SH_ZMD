import { defaultSchema } from 'rehype-sanitize';

const globalAttributes = [
  ...(defaultSchema.attributes?.['*'] || []),
  'className',
  'aria-hidden',
  'aria-label',
  'role',
  'title',
];

export const markdownSanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: 'user-content-',
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto', 'tel'],
    src: ['http', 'https'],
  },
  attributes: {
    ...defaultSchema.attributes,
    '*': globalAttributes,
    a: [
      ...(defaultSchema.attributes?.a || []),
      'href',
      'title',
      'target',
      'rel',
      'className',
    ],
    img: [
      ...(defaultSchema.attributes?.img || []),
      'src',
      'alt',
      'title',
      'width',
      'height',
      'loading',
      'decoding',
      'className',
    ],
    code: [
      ...(defaultSchema.attributes?.code || []),
      'className',
    ],
    pre: [
      ...(defaultSchema.attributes?.pre || []),
      'className',
    ],
    span: [
      ...(defaultSchema.attributes?.span || []),
      'className',
      'aria-hidden',
    ],
    div: [
      ...(defaultSchema.attributes?.div || []),
      'className',
    ],
    math: [
      ...(defaultSchema.attributes?.math || []),
      'xmlns',
      'display',
      'className',
    ],
    annotation: [
      ...(defaultSchema.attributes?.annotation || []),
      'encoding',
    ],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'br',
    'del',
    's',
    'span',
    'div',
    'math',
    'semantics',
    'annotation',
    'mrow',
    'mi',
    'mn',
    'mo',
    'msup',
    'msub',
    'msubsup',
    'mfrac',
    'msqrt',
    'mroot',
    'mtext',
  ],
};
