import assert from 'node:assert/strict';
import {loadMaterialDraft, saveMaterialDraft, clearMaterialDraft} from '../services/materialDraft';

const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
const records = new Map<string, string>();
const storage = {
  getItem: (key: string) => records.get(key) ?? null,
  setItem: (key: string, value: string) => { records.set(key, value); },
  removeItem: (key: string) => { records.delete(key); },
};
Object.defineProperty(globalThis, 'sessionStorage', {value: storage, configurable: true});
try {
  const draft = {kind: 'transcript' as const, title: 'Lesson', body: 'Transcript text'};
  assert.equal(loadMaterialDraft('alice'), null);
  assert.equal(saveMaterialDraft('alice', draft), true);
  assert.deepEqual(loadMaterialDraft('alice'), draft);
  assert.equal(loadMaterialDraft('bob'), null, 'drafts do not leak to another profile');
  for (const language of ['en', 'he', 'ar', 'ru'] as const) {
    saveMaterialDraft('alice', {...draft, language});
    assert.deepEqual(loadMaterialDraft('alice'), {...draft, language});
  }
  records.set('brainwave-material-draft-v1:alice', JSON.stringify({...draft, language:'invalid'}));
  assert.deepEqual(loadMaterialDraft('alice'), draft, 'invalid language preserves usable legacy input');
  saveMaterialDraft('bob', {...draft, title: 'Bob'});
  clearMaterialDraft('alice');
  assert.equal(loadMaterialDraft('alice'), null);
  assert.equal(loadMaterialDraft('bob')?.title, 'Bob');
  for (const value of ['bad JSON', 'null', '{}', JSON.stringify({...draft,kind:'file'}), JSON.stringify({...draft,title:3}), JSON.stringify({...draft,title:'x'.repeat(161)}), JSON.stringify({...draft,body:3}), JSON.stringify({...draft,body:'x'.repeat(60001)})]) {
    records.set('brainwave-material-draft-v1:alice', value);
    assert.equal(loadMaterialDraft('alice'), null);
  }
  Object.defineProperty(globalThis, 'sessionStorage', {get: () => {throw new Error('Storage blocked');}, configurable:true});
  assert.equal(loadMaterialDraft('alice'), null);
  assert.equal(saveMaterialDraft('alice', draft), false);
  assert.equal(clearMaterialDraft('alice'), false);
} finally {
  if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous);
  else Reflect.deleteProperty(globalThis, 'sessionStorage');
}
console.log('Material draft tests passed: restoration, profile isolation, malformed data, and unavailable storage.');
