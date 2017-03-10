'use strict'

const Buffer = require('safe-buffer').Buffer
const BB = require('bluebird')

const crypto = require('crypto')
const fromString = require('./util/from-string')
const fs = BB.promisifyAll(require('fs'))
const index = require('../lib/entry-index')
const memo = require('../lib/memoization')
const path = require('path')
const pipe = BB.promisify(require('mississippi').pipe)
const test = require('tap').test
const testDir = require('./util/test-dir')(__filename)

const CACHE = path.join(testDir, 'cache')
const CONTENT = Buffer.from('foobarbaz', 'utf8')
const KEY = 'my-test-key'
const ALGO = 'sha512'
const DIGEST = crypto.createHash(ALGO).update(CONTENT).digest('hex')
const METADATA = { foo: 'bar' }
const contentPath = require('../lib/content/path')

var put = require('..').put

test('basic bulk insertion', t => {
  return put(CACHE, KEY, CONTENT).then(digest => {
    t.equal(digest, DIGEST, 'returned content digest')
    const dataPath = contentPath(CACHE, digest, ALGO)
    return fs.readFileAsync(dataPath)
  }).then(data => {
    t.deepEqual(data, CONTENT, 'content was correctly inserted')
  })
})

test('basic stream insertion', t => {
  let foundDigest
  const src = fromString(CONTENT)
  const stream = put.stream(CACHE, KEY).on('digest', function (d) {
    foundDigest = d
  })
  return pipe(src, stream).then(() => {
    t.equal(foundDigest, DIGEST, 'returned digest matches expected')
    return fs.readFileAsync(contentPath(CACHE, foundDigest))
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
    t.equal(entry.digest, DIGEST, 'entry has the right key')
    t.deepEqual(entry.metadata, METADATA, 'metadata also inserted')
  })
})

test('optionally memoizes data on bulk insertion', t => {
  return put(CACHE, KEY, CONTENT, {
    metadata: METADATA,
    hashAlgorithm: ALGO,
    memoize: true
  }).then(digest => {
    t.equal(digest, DIGEST, 'digest returned as usual')
    return index.find(CACHE, KEY) // index.find is not memoized
  }).then(entry => {
    t.deepEqual(memo.get(CACHE, KEY), {
      data: CONTENT,
      entry: entry
    }, 'content inserted into memoization cache by key')
    t.deepEqual(
      memo.get.byDigest(CACHE, DIGEST, ALGO),
      CONTENT,
      'content inserted into memoization cache by digest'
    )
  })
})

test('optionally memoizes data on stream insertion', t => {
  let foundDigest
  const src = fromString(CONTENT)
  const stream = put.stream(CACHE, KEY, {
    hashAlgorithm: ALGO,
    metadata: METADATA,
    memoize: true
  }).on('digest', function (d) {
    foundDigest = d
  })
  return pipe(src, stream).then(() => {
    t.equal(foundDigest, DIGEST, 'digest emitted as usual')
    return fs.readFileAsync(contentPath(CACHE, foundDigest))
  }).then(data => {
    t.deepEqual(data, CONTENT, 'contents are identical to inserted content')
    return index.find(CACHE, KEY) // index.find is not memoized
  }).then(entry => {
    t.deepEqual(memo.get(CACHE, KEY), {
      data: CONTENT,
      entry: entry
    }, 'content inserted into memoization cache by key')
    t.deepEqual(
      memo.get.byDigest(CACHE, DIGEST, ALGO),
      CONTENT,
      'content inserted into memoization cache by digest'
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

test('errors if input stream errors', function (t) {
  let foundDigest
  const putter = put.stream(CACHE, KEY).on('digest', function (d) {
    foundDigest = d
  })
  const stream = fromString(false)
  return pipe(
    stream, putter
  ).then(() => {
    throw new Error('expected error')
  }).catch(err => {
    t.ok(err, 'got an error')
    t.ok(!foundDigest, 'no digest returned')
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

test('supports a single cache mirror on bulk puts', t => {
  const MIRROR = CACHE + 'mirror'
  return put(CACHE, KEY, CONTENT, {
    mirror: MIRROR,
    metadata: METADATA
  }).then(digest => {
    t.equal(digest, DIGEST, 'returned content digest')
    return BB.join(
      fs.readFileAsync(contentPath(CACHE, digest, ALGO)),
      fs.readFileAsync(contentPath(MIRROR, digest, ALGO)),
      (mainData, mirrorData) => {
        t.deepEqual(mainData, CONTENT, 'content is in main cache')
        t.deepEqual(mirrorData, CONTENT, 'content is also in mirrored cache')
      }
    )
  }).then(() => {
    return BB.join(
      index.find(CACHE, KEY),
      index.find(MIRROR, KEY),
      (mainEntry, mirrorEntry) => {
        t.ok(mainEntry, 'main entry inserted')
        t.equal(mainEntry.key, KEY, 'main entry has the right key')
        t.equal(mainEntry.digest, DIGEST, 'main entry has the right digest')
        t.deepEqual(
          mainEntry.metadata, METADATA, 'main metadata also inserted')
        t.ok(mirrorEntry, 'mirror entry inserted')
        t.equal(mirrorEntry.key, KEY, 'mirror entry has the right key')
        t.equal(
          mirrorEntry.digest, DIGEST, 'mirror entry has the right digest')
        t.deepEqual(
          mirrorEntry.metadata, METADATA, 'mirror metadata also inserted')
      }
    )
  })
})

test('supports a single cache mirror in stream puts', t => {
  let foundDigest
  const MIRROR = CACHE + 'mirror'
  const src = fromString(CONTENT)
  const stream = put.stream(CACHE, KEY, {
    metadata: METADATA,
    mirror: MIRROR
  }).on('digest', function (d) {
    foundDigest = d
  })
  return pipe(src, stream).then(() => {
    t.equal(foundDigest, DIGEST, 'returned digest matches expected')
    return BB.join(
      fs.readFileAsync(contentPath(CACHE, DIGEST, ALGO)),
      fs.readFileAsync(contentPath(MIRROR, DIGEST, ALGO)),
      (mainData, mirrorData) => {
        t.deepEqual(mainData, CONTENT, 'content is in main cache')
        t.deepEqual(mirrorData, CONTENT, 'content is also in mirrored cache')
      }
    )
  }).then(() => {
    return BB.join(
      index.find(CACHE, KEY),
      index.find(MIRROR, KEY),
      (mainEntry, mirrorEntry) => {
        t.ok(mainEntry, 'main entry inserted')
        t.equal(mainEntry.key, KEY, 'main entry has the right key')
        t.equal(mainEntry.digest, DIGEST, 'main entry has the right digest')
        t.deepEqual(
          mainEntry.metadata, METADATA, 'main metadata also inserted')
        t.ok(mirrorEntry, 'mirror entry inserted')
        t.equal(mirrorEntry.key, KEY, 'mirror entry has the right key')
        t.equal(
          mirrorEntry.digest, DIGEST, 'mirror entry has the right digest')
        t.deepEqual(
          mirrorEntry.metadata, METADATA, 'mirror metadata also inserted')
      }
    )
  })
})

test('supports an array of cache mirrors on bulk puts', t => {
  const MIRROR1 = CACHE + 'mirror1'
  const MIRROR2 = CACHE + 'mirror2'
  const MIRROR3 = CACHE + 'mirror3'
  const MIRROR4 = CACHE + 'mirror4'
  return put(CACHE, KEY, CONTENT, {
    mirror: [MIRROR1, MIRROR2, MIRROR3, MIRROR4],
    metadata: METADATA
  }).then(digest => {
    t.equal(digest, DIGEST, 'returned content digest')
    return BB.join(
      fs.readFileAsync(contentPath(CACHE, digest, ALGO)),
      fs.readFileAsync(contentPath(MIRROR1, digest, ALGO)),
      fs.readFileAsync(contentPath(MIRROR2, digest, ALGO)),
      fs.readFileAsync(contentPath(MIRROR3, digest, ALGO)),
      fs.readFileAsync(contentPath(MIRROR4, digest, ALGO)),
      (mainData, m1, m2, m3, m4) => {
        const arr = [mainData, m1, m2, m3, m4]
        arr.forEach((d, i) => {
          t.deepEqual(
            d, CONTENT, `content is in ${i ? 'mirror #' + i : 'main'} cache`)
        })
      }
    )
  }).then(() => {
    return BB.join(
      index.find(CACHE, KEY),
      index.find(MIRROR1, KEY),
      index.find(MIRROR2, KEY),
      index.find(MIRROR3, KEY),
      index.find(MIRROR4, KEY),
      (mainEntry, m1, m2, m3, m4) => {
        const arr = [mainEntry, m1, m2, m3, m4]
        arr.forEach((e, i) => {
          t.ok(e, 'entry inserted')
          t.equal(e.key, KEY, 'entry has the right key')
          t.equal(e.digest, DIGEST, 'entry has the right digest')
          t.deepEqual(e.metadata, METADATA, 'metadata also inserted')
        })
      }
    )
  })
})

test('supports an array of cache mirrors in stream puts', t => {
  let foundDigest
  const MIRROR1 = CACHE + 'mirror1'
  const MIRROR2 = CACHE + 'mirror2'
  const MIRROR3 = CACHE + 'mirror3'
  const MIRROR4 = CACHE + 'mirror4'
  const src = fromString(CONTENT)
  const stream = put.stream(CACHE, KEY, {
    metadata: METADATA,
    mirror: [MIRROR1, MIRROR2, MIRROR3, MIRROR4]
  }).on('digest', function (d) {
    foundDigest = d
  })
  return pipe(src, stream).then(() => {
    t.equal(foundDigest, DIGEST, 'returned digest matches expected')
    return BB.join(
      fs.readFileAsync(contentPath(CACHE, DIGEST, ALGO)),
      fs.readFileAsync(contentPath(MIRROR1, DIGEST, ALGO)),
      fs.readFileAsync(contentPath(MIRROR2, DIGEST, ALGO)),
      fs.readFileAsync(contentPath(MIRROR3, DIGEST, ALGO)),
      fs.readFileAsync(contentPath(MIRROR4, DIGEST, ALGO)),
      (mainData, m1, m2, m3, m4) => {
        const arr = [mainData, m1, m2, m3, m4]
        arr.forEach((d, i) => {
          t.deepEqual(
            d, CONTENT, `content is in ${i ? 'mirror #' + i : 'main'} cache`)
        })
      }
    )
  }).then(() => {
    return BB.join(
      index.find(CACHE, KEY),
      index.find(MIRROR1, KEY),
      index.find(MIRROR2, KEY),
      index.find(MIRROR3, KEY),
      index.find(MIRROR4, KEY),
      (mainEntry, m1, m2, m3, m4) => {
        const arr = [mainEntry, m1, m2, m3, m4]
        arr.forEach((e, i) => {
          t.ok(e, 'entry inserted')
          t.equal(e.key, KEY, 'entry has the right key')
          t.equal(e.digest, DIGEST, 'entry has the right digest')
          t.deepEqual(e.metadata, METADATA, 'metadata also inserted')
        })
      }
    )
  })
})
