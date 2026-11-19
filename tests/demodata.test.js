import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDemoGalaxy, DEMO_SIGNATURE } from '../src/data/demodata.js';
import { normalizeGalaxy, degreeMap } from '../src/data/model.js';
import { mergeGalaxies } from '../src/data/merge.js';

const start = normalizeGalaxy(JSON.parse(readFileSync(new URL('../public/startgalax.json', import.meta.url), 'utf8')));
const urval = JSON.parse(readFileSync(new URL('../docs/libris-urval.json', import.meta.url), 'utf8'));
const full = mergeGalaxies(start, urval).galaxy;

test('demogalaxen ger varje bok minst en koppling', () => {
  const demo = createDemoGalaxy(full);
  const degree = degreeMap(demo);
  assert.equal(demo.books.length, full.books.length);
  assert.ok(demo.books.every((b) => degree.get(b.id) > 0));
});

test('demogalaxen behåller de riktiga kopplingarna och märker de slumpade', () => {
  const demo = createDemoGalaxy(full);
  const realIds = new Set(full.relations.map((r) => r.id));
  assert.ok(full.relations.every((r) => demo.relations.some((d) => d.id === r.id)));
  const added = demo.relations.filter((r) => !realIds.has(r.id));
  assert.ok(added.length > 0);
  assert.ok(added.every((r) => r.signature === DEMO_SIGNATURE && r.type !== 'serien'));
  // De slumpade kopplingarna går aldrig mellan ett par som redan är kopplat.
  const pair = (r) => [r.from, r.to].sort().join('|');
  const realPairs = new Set(full.relations.map(pair));
  const addedPairs = new Set(added.map(pair));
  assert.equal(addedPairs.size, added.length);
  assert.ok(added.every((r) => !realPairs.has(pair(r))));
  assert.ok(demo.relations.every((r) => r.from !== r.to));
  // Går igenom normaliseringen utan att något försvinner.
  assert.equal(normalizeGalaxy(demo).relations.length, demo.relations.length);
});

test('demogalaxen blir likadan varje gång och rör inte den riktiga', () => {
  const before = JSON.stringify(full);
  const a = createDemoGalaxy(full);
  const b = createDemoGalaxy(full);
  assert.deepEqual(a.relations, b.relations);
  assert.equal(JSON.stringify(full), before);
});
