import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { PhoneDb } from '../offline/db.ts';

let counter = 0;

/** A phone database on a fresh, empty IndexedDB, so tests never share data. */
export function freshPhoneDb(): PhoneDb {
  counter += 1;
  return new PhoneDb(`omp-test-${counter}`, {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
}
