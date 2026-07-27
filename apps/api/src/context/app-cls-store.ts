import type { ClsStore } from 'nestjs-cls';
import type { ActorContext } from './actor.types';

export interface AppClsStore extends ClsStore {
  actor?: ActorContext;
}
