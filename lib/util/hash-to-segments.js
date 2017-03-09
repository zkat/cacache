'use strict'

module.exports = hashToSegments

function hashToSegments (hash) {
  return [
    hash.slice(0, 2),
    hash.slice(2)
  ]
}
