'use strict'

const BB = require('bluebird')

const contentPath = require('./path')
const copy = require('@npmcorp/copy')
const fixOwner = require('../util/fix-owner')
const link = BB.promisify(require('graceful-fs').link)
const path = require('path')

module.exports = mirror
function mirror (source, target, digest, opts) {
  opts = opts || {}
  const from = contentPath(source, digest, opts.hashAlgorithm)
  const to = contentPath(target, digest, opts.hashAlgorithm)
  return fixOwner.mkdirfix(path.dirname(to), opts).then(() => {
    // prefer hard links, fall back to copy on EXDEV and company
    return link(from, to).catch(() => copy.file(from, to))
  })
}
