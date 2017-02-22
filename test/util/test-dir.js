'use strict'

var mkdirp = require('mkdirp')
var path = require('path')
var rimraf = require('rimraf')
var tap = require('tap')

require('graceful-fs')

var cacheDir = path.resolve(__dirname, '../cache')

module.exports = testDir
function testDir (filename) {
  var base = path.basename(filename, '.js')
  var dir = path.join(cacheDir, base)
  tap.beforeEach(function (cb) {
    reset(dir, function (err) {
      if (err) { throw err }
      cb()
    })
  })
  if (!process.env.KEEPCACHE) {
    tap.tearDown(function (cb) {
      process.chdir(__dirname)
      rimraf(dir, cb || function () {})
    })
  }
  return dir
}

module.exports.reset = reset
function reset (testDir, cb) {
  process.chdir(__dirname)
  rimraf(testDir, function (err) {
    if (err) { return cb(err) }
    mkdirp(testDir, function (err) {
      if (err) { return cb(err) }
      process.chdir(testDir)
      cb()
    })
  })
}
