'use strict'

const Promise = require('bluebird')

const index = require('./lib/entry-index')
const memo = require('./lib/memoization')
const path = require('path')
const rimraf = Promise.promisify(require('rimraf'))
const rmContent = require('./lib/content/rm')

module.exports = entry
module.exports.entry = entry
function entry (cache, key) {
  memo.clearMemoized()
  return index.delete(cache, key)
}

module.exports.content = content
function content (cache, address) {
  memo.clearMemoized()
  return rmContent(cache, address)
}

module.exports.all = all
function all (cache) {
  memo.clearMemoized()
  return rimraf(path.join(cache, '*(content-*|index-*)'))
}
