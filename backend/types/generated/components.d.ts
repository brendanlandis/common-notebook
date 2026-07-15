import type { Schema, Struct } from '@strapi/strapi';

export interface ViewSection extends Struct.ComponentSchema {
  collectionName: 'components_view_sections';
  info: {
    displayName: 'section';
  };
  attributes: {
    importance: Schema.Attribute.Enumeration<
      [
        'any',
        'soonAndTopOfMind',
        'soonAndTopOfMind-regular',
        'regular',
        'regular-later',
        'later',
      ]
    > &
      Schema.Attribute.DefaultTo<'any'>;
    longOnly: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    name: Schema.Attribute.String;
    projectType: Schema.Attribute.Enumeration<['any', 'chores']> &
      Schema.Attribute.DefaultTo<'any'>;
    recurrence: Schema.Attribute.Enumeration<
      ['both', 'recurring', 'nonRecurring']
    > &
      Schema.Attribute.DefaultTo<'both'>;
    worldMode: Schema.Attribute.Enumeration<['all', 'only', 'except']> &
      Schema.Attribute.DefaultTo<'all'>;
    worlds: Schema.Attribute.Relation<'oneToMany', 'api::world.world'>;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'view.section': ViewSection;
    }
  }
}
