'use strict'

var checksumStream = require('../util/checksum-stream')
var contentPath = require('./path')
var dezalgo = require('dezalgo')
var fs = require('graceful-fs')
var pipe = require('mississippi').pipe

module.exports.readStream = readStream
function readStream (cache, address, opts) {
  opts = opts || {}
  var stream = checksumStream(address, opts.hashAlgorithm || 'sha1')
  var cpath = contentPath(cache, address)
  hasContent(cache, address, function (err, exists) {
    if (err) { return stream.emit('error', err) }
    if (!exists) {
      err = new Error('content not found')
      err.code = 'ENOENT'
      err.cache = cache
      err.digest = address
      return stream.emit('error', err)
    } else {
      pipe(fs.createReadStream(cpath), stream)
    }
  })
  return stream
}

module.exports.hasContent = hasContent
function hasContent (cache, address, cb) {
  cb = dezalgo(cb)
  if (!address) { return cb(null, false) }
  fs.lstat(contentPath(cache, address), function (err) {
    if (err && err.code === 'ENOENT') {
      return cb(null, false)
    } else if (err && process.platform === 'win32' && err.code === 'EPERM') {
      return cb(null, false)
    } else if (err) {
      return cb(err)
    } else {
      return cb(null, true)
    }
  })
}
