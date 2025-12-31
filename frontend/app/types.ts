import { type BlocksContent } from '@strapi/blocks-react-renderer';

export interface Media {
  id: number;
  name: string;
  documentId: string;
  alternativeText: string;
  caption: string;
  width: number;
  height: number;
  mime: string;
  size: number;
  url: string;
}

export interface Tab {
  id: number;
  documentId: string;
  band: {
    id: number;
    name: string;
  };
  createdAt: Date;
  tags: string;
  url: string;
  linkText: string;
  description: BlocksContent;
}

export interface Fav {
  id: number;
  documentId: string;
  createdAt: Date;
  type: string;
  creator: string;
  title: string;
  url: string;
  cover: Media;
  about: BlocksContent;
}
