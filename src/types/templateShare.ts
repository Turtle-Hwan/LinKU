export interface PortableIconBuiltin {
  kind: "builtin";
  key: string;
}

export interface PortableIconData {
  kind: "data";
  name: string;
  dataUrl: string;
}

export type PortableIcon = PortableIconBuiltin | PortableIconData;

export interface PortableTemplateItem {
  name: string;
  siteUrl: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  icon: PortableIcon;
}

export interface TemplateSharePayloadV1 {
  version: 1;
  template: {
    name: string;
    height: number;
    items: PortableTemplateItem[];
  };
}
