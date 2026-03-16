import Dexie, { type EntityTable } from 'dexie';
import type { AppArtifact, ArtifactMemo, Condition, ConditionGroup, Settings } from './types';

const db = new Dexie('AFManagerDatabase') as Dexie & {
    artifacts: EntityTable<AppArtifact, 'id'>;
    memos: EntityTable<ArtifactMemo, 'id'>;
    conditions: EntityTable<Condition, 'id'>;
    settings: EntityTable<Settings, 'id'>;
    groups: EntityTable<ConditionGroup, 'id'>;
};

// We only specify properties that need to be indexed.
// For performance in lookups and sorting.
db.version(2).stores({
    artifacts: 'id, artifact_id, attribute, kind, is_locked, is_unnecessary, keepFlag, evaluationScore, inventoryOrder',
    memos: 'id',
    conditions: 'id, listId, priority',
    settings: 'id'
});
db.version(3).stores({
    artifacts: 'id, artifact_id, attribute, kind, is_locked, is_unnecessary, keepFlag, discardFlag, evaluationScore, inventoryOrder'
});
db.version(4).stores({
    groups: 'id, order'
});

export { db };
