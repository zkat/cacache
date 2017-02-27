# cacache [![npm version](https://img.shields.io/npm/v/cacache.svg)](https://npm.im/cacache) [![license](https://img.shields.io/npm/l/cacache.svg)](https://npm.im/cacache) [![Travis](https://img.shields.io/travis/zkat/cacache.svg)](https://travis-ci.org/zkat/cacache) [![AppVeyor](https://ci.appveyor.com/api/projects/status/github/zkat/cacache?svg=true)](https://ci.appveyor.com/project/zkat/cacache) [![Coverage Status](https://coveralls.io/repos/github/zkat/cacache/badge.svg?branch=latest)](https://coveralls.io/github/zkat/cacache?branch=latest)

[`cacache`](https://github.com/zkat/cacache) is a Node.js library for managing
caches of keyed data that can be looked up both by key and by a digest of the
content itself. This means that by-content lookups can be very very fast, and
that stored content is shared by different keys if they point to the same data.

## Install

`$ npm install --save cacache`

## Table of Contents

* [Example](#example)
* [Features](#features)
* [Contributing](#contributing)
* [API](#api)
  * [`ls`](#ls)
  * [`get.stream`](#get-stream)
  * [`get.info`](#get-info)
  * [`put.stream`](#put-stream)
  * [`put options`](#put-options)
  * [`rm.all`](#rm-all)
  * [`rm.entry`](#rm-entry)
  * [`rm.content`](#rm-content)
  * [`verify`](#verify)
  * [`verify.lastRun`](#verify-last-run)

### Example

```javascript
const cacache = require('cacache')
const fs = require('fs')

const tarball = '/path/to/mytar.tgz'
const cachePath = '/tmp/my-toy-cache'
const key = 'my-unique-key-1234'
let tarballDigest = null

// Cache it! Use `cachePath` as the root of the content cache
fs.createReadStream(
  tarball
).pipe(
  cacache.put.stream(
    cachePath, key
  ).on('digest', (d) => tarballDigest = d)
).on('finish', function () {
  console.log(`Saved ${tarball} to ${cachePath}.`)
})

const destination = '/tmp/mytar.tgz'

// Copy the contents out of the cache and into their destination!
cacache.get.stream(
  cachePath, key
).pipe(
  fs.createWriteStream(destination)
).on('finish', () => {
  console.log('done extracting!')
})

// The same thing, but skip the key index.
cacache.get.stream.byDigest(
  cachePath, tarballDigest
).pipe(
  fs.createWriteStream(destination)
).on('finish', () => {
  console.log('done extracting using sha1!')
})
```

### Features

* Extraction by key or by content digest (shasum, etc).
* Deduplicated content by digest -- two inputs with same key are only saved once
* Consistency checks, both on insert and extract.
* (Kinda) concurrency-safe and fault tolerant.
* Streaming support.
* Metadata storage.

### Contributing

The cacache team enthusiastically welcomes contributions and project participation! There's a bunch of things you can do if you want to contribute! The [Contributor Guide](CONTRIBUTING.md) has all the information you need for everything from reporting bugs to contributing entire new features. Please don't hesitate to jump in if you'd like to, or even ask us questions if something isn't clear.

### API

#### <a name="ls"></a> `> cacache.ls(cache) -> Promise`

Lists info for all entries currently in the cache as a single large object. Each
entry in the object will be keyed by the unique index key, with corresponding
[`get.info`](#get-info) objects as the values.

##### Example

```javascript
cacache.ls(cachePath).then(console.log)
// Output
{
  'my-thing': {
    key: 'my-thing',
    digest: 'deadbeef',
    path: '.testcache/content/deadbeef',
    time: 12345698490,
    metadata: {
      name: 'blah',
      version: '1.2.3',
      description: 'this was once a package but now it is my-thing'
    }
  },
  'other-thing': {
    key: 'other-thing',
    digest: 'bada55',
    path: '.testcache/content/bada55',
    time: 11992309289
  }
}
```

#### <a name="get-stream"></a> `> cacache.get.stream(cache, key, [opts]) -> Readable`

Returns a stream of the cached data identified by `key`.

If there is no content identified by `key`, or if the locally-stored data does
not pass the validity checksum, an error will be emitted.

A sub-function, `get.stream.byDigest` may be used for identical behavior,
except lookup will happen by content digest, bypassing the index entirely.

##### Example

```javascript
cache.get.stream(
  cachePath, 'my-thing'
).pipe(
  fs.createWriteStream('./x.tgz')
)

cache.get.stream.byDigest(
  cachePath, 'deadbeef'
).pipe(
  fs.createWriteStream('./x.tgz')
)
```

#### <a name="get-info"></a> `> cacache.get.info(cache, key) -> Promise`

Looks up `key` in the cache index, returning information about the entry if
one exists. If an entry does not exist, the second argument to `cb` will be
falsy.

##### Fields

* `key` - Key the entry was looked up under. Matches the `key` argument.
* `digest` - Content digest the entry refers to.
* `path` - Filesystem path relative to `cache` argument where content is stored.
* `time` - Timestamp the entry was first added on.
* `metadata` - User-assigned metadata associated with the entry/content.

##### Example

```javascript
cacache.get.info(cachePath, 'my-thing').then(console.log)

// Output
{
  key: 'my-thing',
  digest: 'deadbeef',
  path: '.testcache/content/deadbeef',
  time: 12345698490,
  metadata: {
    name: 'blah',
    version: '1.2.3',
    description: 'this was once a package but now it is my-thing'
  }
}
```

#### <a name="put-stream"></a> `> cacache.put.stream(cache, key, stream, [opts]) -> Writable`

Inserts data from a stream into the cache. Emits a `digest` event with the
digest of written contents when it succeeds.

##### Example

```javascript
request.get(
  'https://registry.npmjs.org/cacache/-/cacache-1.0.0.tgz'
).pipe(
  cacache.put.stream(
    cachePath, 'registry.npmjs.org|cacache@1.0.0'
  ).on('digest', d => console.log(`digest is ${d}`))
)
```

#### <a name="put-options"></a> `> cacache.put options`

`cacache.put` functions have a number of options in common.

##### `metadata`

Arbitrary metadata to be attached to the inserted key.

##### `size`

If provided, the data stream will be verified to check that enough data was
passed through. If there's more or less data than expected, an `EBADSIZE` error
will be returned.

##### `digest`

If present, the pre-calculated digest for the inserted content. If this option
if provided and does not match the post-insertion digest, insertion will fail.

To control the hashing algorithm, use `opts.hashAlgorithm`.

##### `hashAlgorithm`

Default: 'sha1'

Hashing algorithm to use when calculating the digest for inserted data. Can use
any algorithm supported by Node.js' `crypto` module.

##### `uid`/`gid`

If provided, cacache will do its best to make sure any new files added to the
cache use this particular `uid`/`gid` combination. This can be used,
for example, to drop permissions when someone uses `sudo`, but cacache makes
no assumptions about your needs here.

#### <a name="rm-all"></a> `> cacache.rm.all(cache) -> Promise`

Clears the entire cache. Mainly by blowing away the cache directory itself.

##### Example

```javascript
cacache.rm.all(cachePath).then(() => {
  console.log('THE APOCALYPSE IS UPON US 😱')
})
```

#### <a name="rm-entry"></a> `> cacache.rm.entry(cache, key) -> Promise`

Removes the index entry for `key`. Content will still be accessible if
requested directly by content address ([`get.stream.byDigest`](#get-stream)).

##### Example

```javascript
cacache.rm.entry(cachePath, 'my-thing').then(() => {
  console.log('I did not like it anyway')
})
```

#### <a name="rm-content"></a> `> cacache.rm.content(cache, digest) -> Promise`

Removes the content identified by `digest`. Any index entries referring to it
will not be usable again until the content is re-added to the cache with an
identical digest.

##### Example

```javascript
cacache.rm.content(cachePath, 'deadbeef').then(() => {
  console.log('data for my-thing is gone!')
})
```

#### <a name="verify"></a> `> cacache.verify(cache, opts) -> Promise`

Checks out and fixes up your cache:

* Cleans up corrupted or invalid index entries.
* Garbage collects any content entries not referenced by the index.
* Checks digests for all content entries and removes invalid content.
* Fixes cache ownership.
* Removes the `tmp` directory in the cache and all its contents.

When it's done, it'll return an object with various stats about the verification
process, including amount of storage reclaimed, number of valid entries, number
of entries removed, etc.

This function should not be run while other processes are running `cacache`. It
assumes it'll be used offline by a human or a coordinated process. Concurrent
verifies are protected by a lock, but there's no guarantee others won't be
reading/writing on the cache.

##### Options

* `opts.uid` - uid to assign to cache and its contents
* `opts.gid` - gid to assign to cache and its contents
* `opts.hashAlgorithm` - defaults to `'sha256'`. Hash to use for content checks.


##### Example

```sh
echo somegarbage >> $CACHEPATH/content/deadbeef
```

```javascript
cacache.verify(cachePath).then(stats => {
  // deadbeef collected, because of invalid checksum.
  console.log('cache is much nicer now! stats:', stats)
})
```

#### <a name="verify-last-run"></a> `> cacache.verify.lastRun(cache) -> Promise`

Returns a `Date` representing the last time `cacache.verify` was run on `cache`.

##### Example

```javascript
cacache.verify(cachePath).then(() => {
  cacache.verify.lastRun(cachePath).then(lastTime => {
    console.log('cacache.verify was last called on' + lastTime)
  })
})
```
