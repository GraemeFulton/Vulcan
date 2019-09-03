import expect from 'expect';
import sinon from 'sinon/pkg/sinon.js';

import { createMutator, updateMutator } from '../../lib/server/mutators';
//import StubCollections from 'meteor/hwillson:stub-collections';
import Users from 'meteor/vulcan:users';

const test = it; // TODO: just before we switch to jest

// stub collection
import {
  getDefaultResolvers,
  getDefaultMutations,
  addCallback,
  removeAllCallbacks, createCollection,
} from 'meteor/vulcan:core';
import {
  isoCreateCollection,
  initServerTest
} from 'meteor/vulcan:test';

const createDummyCollection = (typeName, schema) =>
  createCollection({
    collectionName: typeName + 's',
    typeName,
    schema,
    resolvers: getDefaultResolvers(typeName + 's'),
    mutations: getDefaultMutations(typeName + 's'),
  });
const foo2Schema = {
  _id: {
    type: String,
    canRead: ['guests'],
    optional: true,
  },
  foo2: {
    type: String,
    canCreate: ['guests'],
    canRead: ['guests'],
    canUpdate: ['guests'],
  },
  publicAuto: {
    optional: true,
    type: String,
    canCreate: ['guests'],
    canRead: ['guests'],
    canUpdate: ['guests'],
    onCreate: () => {
      return 'CREATED';
    },
    onUpdate: () => {
      return 'UPDATED';
    }
  },
  privateAuto: {
    optional: true,
    type: String,
    canCreate: ['admins'],
    canRead: ['admins'],
    canUpdate: ['admins'],
    onCreate: () => {
      return 'CREATED';
    },
    onUpdate: () => {
      return 'UPDATED';
    }
  }
};
let Foo2s = createDummyCollection('Foo2', foo2Schema);


describe('vulcan:lib/mutators', function () {

  let defaultArgs;
  let createArgs;
  let updateArgs;
  before(async function () {
    initServerTest();

    /*Foo2s = await isoCreateCollection({
      collectionName: 'Foo2s',
      typeName: 'Foo2',
      schema: {
        _id: {
          type: String,
          canRead: ['guests'],
          optional: true,
        },
        foo: {
          type: String,
          canCreate: ['guests'],
          canRead: ['guests'],
          canUpdate: ['guests'],
        },
      },
      resolvers: getDefaultResolvers('Foo2s'),
      mutations: getDefaultMutations('Foo2s'),
    });*/
  });
  beforeEach(function () {
    removeAllCallbacks('foo2.create.after');
    removeAllCallbacks('foo2.create.before');
    removeAllCallbacks('foo2.create.async');
    defaultArgs = {
      collection: Foo2s,
      currentUser: null,
      validate: () => true,
      context: {
        Users
      }
    };
    createArgs = {
      ...defaultArgs,
    };
    updateArgs = {
      ...defaultArgs

    };
  });

  describe('basic', () => {
    test('should run createMutator', async function () {
      const { data: resultDocument } = await createMutator({
        ...createArgs,
        document: { foo2: 'bar' }
      });
      expect(resultDocument).toBeDefined();
    });
    test('create should not mutate the provided data', async () => {
      const foo = { foo2: 'foo' };
      const fooCopy = { ...foo };
      const { data: resultDocument } = await createMutator({ ...createArgs, document: foo });
      expect(foo).toEqual(fooCopy);
    });
    test('update should not mutate the provided data', async () => {
      const fooUpdate = { foo2: 'fooUpdate' };
      const fooUpdateCopy = { ...fooUpdate };
      const { data: foo } = await createMutator({ ...createArgs, document: { foo2: 'foo' } });
      const { data: resultDocument } = await updateMutator({
        ...updateArgs,
        documentId: foo._id,
        data: fooUpdate,
      });
      expect(fooUpdate).toEqual(fooUpdateCopy);
    });
  });

  describe('onCreate/onUpdate', () => {
    test('run onCreate callbacks during creation', async () => {
      const { data: resultDocument } = await createMutator({
        ...createArgs,
        document: { foo2: 'bar' }
      });
      expect(resultDocument.publicAuto).toEqual('CREATED');
    });
    test('run onUpdate callback during update', async () => {
      const { data: foo } = await createMutator({ ...createArgs, document: { foo2: 'bar' } });
      const { data: resultDocument } = await updateMutator({
        ...updateArgs,
        documentId: foo._id,
        data: { foo2: 'update' },
      });
      expect(resultDocument.publicAuto).toEqual('UPDATED');
    });
    test('filter out non allowed field created by onCreate before returning new document', async () => {
      const { data: resultDocument } = await createMutator({
        ...defaultArgs,
        document: { foo2: 'bar' }
      });
      expect(resultDocument.privateAuto).not.toBeDefined();
    });
    test('filter out non allowed field created by onUpdate before returning updated document', async () => {
      const { data: foo } = await createMutator({ ...defaultArgs, document: { foo2: 'bar' } });
      const { data: resultDocument } = await updateMutator({
        ...defaultArgs,
        documentId: foo._id,
        data: { foo2: 'update' }
      });
      expect(resultDocument.privateAuto).not.toBeDefined();

    });
  });

  describe('create callbacks', () => {
    // before
    test.skip('run before callback before document is saved', function () {
      // TODO get the document in the database
    });
    //after
    test('run after callback  before document is returned', async function () {
      const afterSpy = sinon.spy();
      addCallback('foo2.create.after', (document) => {
        afterSpy();
        document.after = true;
        return document;
      });
      const { data: resultDocument } = await createMutator({ ...createArgs, document: { foo2: 'bar' } });
      expect(afterSpy.calledOnce).toBe(true);
      expect(resultDocument.after).toBe(true);
    });
    // async
    test('run async callback', async function () {
      // TODO need a sinon stub
      const asyncSpy = sinon.spy();
      addCallback('foo2.create.async', (properties) => {
        asyncSpy(properties);
        // TODO need a sinon stub
        //expect(originalData.after).toBeUndefined()
      });
      const { data: resultDocument } = await createMutator({ ...createArgs, document: { foo2: 'bar' } });
      expect(asyncSpy.calledOnce).toBe(true);
    });
    test.skip('provide initial data to async callbacks', async function () {
      const asyncSpy = sinon.spy();
      addCallback('foo2.create.after', (document) => {
        document.after = true;
        return document;
      });
      addCallback('foo2.create.async', (properties) => {
        asyncSpy(properties);
        // TODO need a sinon stub
        //expect(originalData.after).toBeUndefined()
      });
      const { data: resultDocument } = await createMutator({ ...createArgs, document: { foo2: 'bar' } });
      expect(asyncSpy.calledOnce).toBe(true);
      // TODO: check result
    });

  });

});
