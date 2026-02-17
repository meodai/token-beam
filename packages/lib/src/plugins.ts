export type PluginLink = {
  id: string;
  name: string;
  url: string;
};

export const pluginLinks: PluginLink[] = [
  {
    id: 'figma',
    name: 'Figma',
    url: 'https://github.com/meodai/token-beam/tree/main/packages/figma-plugin',
  },
  {
    id: 'sketch',
    name: 'Sketch',
    url: 'https://github.com/meodai/token-beam/tree/main/packages/sketch-plugin',
  },
  {
    id: 'blender',
    name: 'Blender',
    url: 'https://github.com/meodai/token-beam/tree/main/packages/blender-plugin',
  },
  {
    id: 'aseprite',
    name: 'Aseprite',
    url: 'https://github.com/meodai/token-beam/tree/main/packages/aseprite-plugin',
  },
  {
    id: 'krita',
    name: 'Krita',
    url: 'https://github.com/meodai/token-beam/tree/main/packages/krita-plugin',
  },
  {
    id: 'adobe-xd',
    name: 'Adobe XD',
    url: 'https://github.com/meodai/token-beam/tree/main/packages/adobe-xd-plugin',
  },
];
