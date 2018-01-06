'use strict'

const Buffer = require('safe-buffer').Buffer
const BB = require('bluebird')

const fromString = require('./util/from-string')
const fs = BB.promisifyAll(require('fs'))
const index = require('../lib/entry-index')
const memo = require('../lib/memoization')
const path = require('path')
const pipe = BB.promisify(require('pump'))
const test = require('tap').test
const testDir = require('./util/test-dir')(__filename)
const ssri = require('ssri')

const CACHE = path.join(testDir, 'cache')
const CONTENT = Buffer.from('foobarbaz', 'utf8')
const KEY = 'my-test-key'
const INTEGRITY = ssri.fromData(CONTENT).toString()
const METADATA = { foo: 'bar' }
const contentPath = require('../lib/content/path')

var put = require('..').put

test('basic bulk insertion', t => {
  return put(CACHE, KEY, CONTENT).then(integrity => {
    t.equal(integrity.toString(), INTEGRITY, 'returned content integrity')
    const dataPath = contentPath(CACHE, integrity)
    return fs.readFileAsync(dataPath)
  }).then(data => {
    t.deepEqual(data, CONTENT, 'content was correctly inserted')
  })
})

test('basic stream insertion', t => {
  let int
  const src = fromString(CONTENT)
  const stream = put.stream(CACHE, KEY).on('integrity', i => {
    int = i
  })
  return pipe(src, stream).then(() => {
    t.equal(int.toString(), INTEGRITY, 'returned integrity matches expected')
    return fs.readFileAsync(contentPath(CACHE, int))
  }).then(data => {
    t.deepEqual(data, CONTENT, 'contents are identical to inserted content')
  })
})

test('adds correct entry to index before finishing', t => {
  return put(CACHE, KEY, CONTENT, {metadata: METADATA}).then(() => {
    return index.find(CACHE, KEY)
  }).then(entry => {
    t.ok(entry, 'got an entry')
    t.equal(entry.key, KEY, 'entry has the right key')
    t.equal(entry.integrity, INTEGRITY, 'entry has the right key')
    t.deepEqual(entry.metadata, METADATA, 'metadata also inserted')
  })
})

test('optionally memoizes data on bulk insertion', t => {
  return put(CACHE, KEY, CONTENT, {
    metadata: METADATA,
    memoize: true
  }).then(integrity => {
    t.equal(integrity.toString(), INTEGRITY, 'integrity returned as usual')
    return index.find(CACHE, KEY) // index.find is not memoized
  }).then(entry => {
    t.deepEqual(memo.get(CACHE, KEY), {
      data: CONTENT,
      entry: entry
    }, 'content inserted into memoization cache by key')
    t.deepEqual(
      memo.get.byDigest(CACHE, INTEGRITY),
      CONTENT,
      'content inserted into memoization cache by integrity'
    )
  })
})

test('optionally memoizes data on stream insertion', t => {
  let int
  const src = fromString(CONTENT)
  const stream = put.stream(CACHE, KEY, {
    metadata: METADATA,
    memoize: true
  }).on('integrity', i => { int = i })
  return pipe(src, stream).then(() => {
    t.equal(int.toString(), INTEGRITY, 'integrity emitted as usual')
    return fs.readFileAsync(contentPath(CACHE, int))
  }).then(data => {
    t.deepEqual(data, CONTENT, 'contents are identical to inserted content')
    return index.find(CACHE, KEY) // index.find is not memoized
  }).then(entry => {
    t.deepEqual(memo.get(CACHE, KEY), {
      data: CONTENT,
      entry: entry
    }, 'content inserted into memoization cache by key')
    t.deepEqual(
      memo.get.byDigest(CACHE, INTEGRITY),
      CONTENT,
      'content inserted into memoization cache by integrity'
    )
  })
})

test('signals error if error writing to cache', t => {
  return BB.join(
    put(CACHE, KEY, CONTENT, {
      size: 2
    }).then(() => {
      throw new Error('expected error')
    }).catch(err => err),
    pipe(fromString(CONTENT), put.stream(CACHE, KEY, {
      size: 2
    })).then(() => {
      throw new Error('expected error')
    }).catch(err => err),
    (bulkErr, streamErr) => {
      t.equal(bulkErr.code, 'EBADSIZE', 'got error from bulk write')
      t.equal(streamErr.code, 'EBADSIZE', 'got error from stream write')
    }
  )
})

test('errors if input stream errors', t => {
  let int
  const putter = put.stream(CACHE, KEY).on('integrity', i => {
    int = i
  })
  const stream = fromString(false)
  return pipe(
    stream, putter
  ).then(() => {
    throw new Error('expected error')
  }).catch(err => {
    t.ok(err, 'got an error')
    t.ok(!int, 'no integrity returned')
    t.match(
      err.message,
      /Invalid non-string/,
      'returns the error from input stream'
    )
    return fs.readdirAsync(testDir)
  }).then(files => {
    t.deepEqual(files, [], 'no files created')
  })
})
