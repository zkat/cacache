'use strict'

const index = require('./lib/entry-index')
const memo = require('./lib/memoization')
const mirror = require('./lib/content/mirror')
const write = require('./lib/content/write')
const to = require('mississippi').to

module.exports = putData
function putData (cache, key, data, opts) {
  opts = opts || {}
  return write(cache, data, opts).then(digest => {
    return index.insert(cache, key, digest, opts).then(entry => {
      if (opts.memoize) {
        memo.put(cache, entry, data)
      }
      return handleMirroring(
        cache, opts.mirror, entry, digest, opts
      ).then(() => digest)
    })
  })
}

module.exports.stream = putStream
function putStream (cache, key, opts) {
  opts = opts || {}
  let digest
  const contentStream = write.stream(cache, opts).on('digest', d => {
    digest = d
  })
  let memoData
  let memoTotal = 0
  const stream = to((chunk, enc, cb) => {
    contentStream.write(chunk, enc, () => {
      if (opts.memoize) {
        if (!memoData) { memoData = [] }
        memoData.push(chunk)
        memoTotal += chunk.length
      }
      cb()
    })
  }, cb => {
    contentStream.end(() => {
      index.insert(cache, key, digest, opts).then(entry => {
        if (opts.memoize) {
          memo.put(cache, entry, Buffer.concat(memoData, memoTotal))
        }
        handleMirroring(cache, opts.mirror, entry, digest, opts).then(() => {
          stream.emit('digest', digest)
          cb()
        })
      })
    })
  })
  let erred = false
  stream.once('error', err => {
    if (erred) { return }
    erred = true
    contentStream.emit('error', err)
  })
  contentStream.once('error', err => {
    if (erred) { return }
    erred = true
    stream.emit('error', err)
  })
  return stream
}

function handleMirroring (cache, target, entry, digest, opts) {
  if (typeof target === 'string') {
    return mirror(cache, target, digest, opts).then(() => {
      return index.insert(target, entry.key, digest, opts)
    }).catch(err => {
      opts.log && opts.log.warn(
        'cache',
        `mirroring failed\n  from: ${cache}\n  to: ${opts.mirror}\n\n${err}`)
    })
  } else if (Array.isArray(target)) {
    return Promise.all(
      target.map(
        m => handleMirroring(cache, m, entry, digest, opts)))
  } else {
    return Promise.resolve()
  }
}
