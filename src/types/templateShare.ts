export interface PortableIconBuiltin {
  kind: "builtin";
  key: string;
}

export interface PortableIconData {
  kind: "data";
  name: string;
  dataUrl: string;
}

export interface PortableIconRemote {
  kind: "remote";
  name: string;
  url: string;
}

export type PortableIcon =
  | PortableIconBuiltin
  | PortableIconData
  | PortableIconRemote;

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
