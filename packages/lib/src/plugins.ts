export type PluginLink = {
  id: string;
  name: string;
  url: string;
};

export const pluginLinks: PluginLink[] = [
  {
    id: 'figma',
    name: 'Figma',
    url: 'https://example.com/figma-plugin',
  },
  {
    id: 'aseprite',
    name: 'Aseprite',
    url: 'https://www.aseprite.org/',
  },
];
