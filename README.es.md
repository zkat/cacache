# cacache [![npm version](https://img.shields.io/npm/v/cacache.svg)](https://npm.im/cacache) [![license](https://img.shields.io/npm/l/cacache.svg)](https://npm.im/cacache) [![Travis](https://img.shields.io/travis/zkat/cacache.svg)](https://travis-ci.org/zkat/cacache) [![AppVeyor](https://ci.appveyor.com/api/projects/status/github/zkat/cacache?svg=true)](https://ci.appveyor.com/project/zkat/cacache) [![Coverage Status](https://coveralls.io/repos/github/zkat/cacache/badge.svg?branch=latest)](https://coveralls.io/github/zkat/cacache?branch=latest)

[`cacache`](https://github.com/zkat/cacache) es una librería de Node.js para manejar caches locales en disco, con acceso tanto con claves únicas como direcciones de contenido (hashes). Es súper rápida, excelente con el acceso concurrente, y jamás te dará datos incorrectos, aún si se corrompen o manipulan directamente los ficheros del cache.

El propósito original era reemplazar el caché local de [npm](https://npm.im/npm), pero se puede usar por su propia cuenta.

_Traducciones: [English](README.md)_

## Instalación

`$ npm install --save cacache`

## Índice

* [Ejemplo](#ejemplo)
* [Características](#características)
* [Cómo Contribuir](#cómo-contribuir)
* [API](#api)
  * Leer
    * [`ls`](#ls)
    * [`ls.stream`](#ls-stream)
    * [`get`](#get-data)
    * [`get.stream`](#get-stream)
    * [`get.info`](#get-info)
    * [`get.hasContent`](#get-hasContent)
  * Escribir
    * [`put`](#put-data)
    * [`put.stream`](#put-stream)
    * [`put*` opts](#put-options)
    * [`rm.all`](#rm-all)
    * [`rm.entry`](#rm-entry)
    * [`rm.content`](#rm-content)
  * Utilidades
    * [`setLocale`](#set-locale)
    * [`clearMemoized`](#clear-memoized)
    * [`tmp.mkdir`](#tmp-mkdir)
    * [`tmp.withTmp`](#with-tmp)
  * Integridad
    * [Subresource Integrity](#integrity)
    * [`verify`](#verify)
    * [`verify.lastRun`](#verify-last-run)

### Ejemplo

```javascript
const cacache = require('cacache')
const fs = require('fs')

const tarball = '/path/to/mytar.tgz'
const cachePath = '/tmp/my-toy-cache'
const key = 'my-unique-key-1234'

// ¡Añádelo al caché! Usa `cachePath` como raíz del caché.
cacache.put(cachePath, key, '10293801983029384').then(integrity => {
  console.log(`Saved content to ${cachePath}.`)
})

const destination = '/tmp/mytar.tgz'

// Copia el contenido del caché a otro fichero, pero esta vez con streams.
cacache.get.stream(
  cachePath, key
).pipe(
  fs.createWriteStream(destination)
).on('finish', () => {
  console.log('done extracting!')
})

// La misma cosa, pero accesando el contenido directamente, sin tocar el índice.
cacache.get.byDigest(cachePath, integrityHash).then(data => {
  fs.writeFile(destination, data, err => {
    console.log('tarball data fetched based on its sha512sum and written out!')
  })
})
```

### Características

* Extracción por clave o por dirección de contenido (shasum, etc)
* Usa el estándard de web, [Subresource Integrity](#integrity)
* Compatible con multiples algoritmos - usa sha1, sha512, etc, en el mismo caché sin problema
* Entradas con contenido idéntico comparten ficheros
* Tolerancia de fallas (inmune a corrupción, ficheros parciales, carreras de proceso, etc)
* Verificación completa de datos cuando (escribiendo y leyendo)
* Concurrencia rápida, segura y "lockless"
* Compatible con `stream`s
* Compatible con `Promise`s
* Bastante rápida -- acceso, incluyendo verificación, en microsegundos
* Almacenaje de metadata arbitraria
* Colección de basura y verificación adicional fuera de banda
* Cobertura rigurosa de pruebas
* Probablente hay un "Bloom filter" por ahí en algún lado. Eso le mola a la gente, ¿Verdad? 🤔

### Cómo Contribuir

El equipo de cacache felizmente acepta contribuciones de código y otras maneras de participación. ¡Hay muchas formas diferentes de contribuir! La [Guía de Colaboradores](CONTRIBUTING.md) (en inglés) tiene toda la información que necesitas para cualquier tipo de contribución: todo desde cómo reportar errores hasta cómo someter parches con nuevas características. Con todo y eso, no se preocupe por si lo que haces está exáctamente correcto: no hay ningún problema en hacer preguntas si algo no está claro, o no lo encuentras.

El equipo de cacache tiene miembros hispanohablantes: es completamente aceptable crear `issues` y `pull requests` en español/castellano.

Todos los participantes en este proyecto deben obedecer el [Código de Conducta](CODE_OF_CONDUCT.md) (en inglés), y en general actuar de forma amable y respetuosa mientras participan en esta comunidad.

Por favor refiérase al [Historial de Cambios](CHANGELOG.md) (en inglés) para detalles sobre cambios importantes incluídos en cada versión.

Finalmente, cacache tiene un sistema de localización de lenguaje. Si te interesa añadir lenguajes o mejorar los que existen, mira en el directorio `./locales` para comenzar.

Happy hacking!

### API

#### <a name="ls"></a> `> cacache.ls(cache) -> Promise<Object>`

Enumera todas las entradas en el caché, dentro de un solo objeto. Cada entrada
en el objeto tendrá como clave la clave única usada para el índice, el valor
siendo un objeto de [`get.info`](#get-info).

##### Ejemplo

```javascript
cacache.ls(cachePath).then(console.log)
// Output
{
  'my-thing': {
    key: 'my-thing',
    integrity: 'sha512-BaSe64/EnCoDED+HAsh=='
    path: '.testcache/content/deadbeef', // joined with `cachePath`
    time: 12345698490,
    size: 4023948,
    metadata: {
      name: 'blah',
      version: '1.2.3',
      description: 'this was once a package but now it is my-thing'
    }
  },
  'other-thing': {
    key: 'other-thing',
    integrity: 'sha1-ANothER+hasH=',
    path: '.testcache/content/bada55',
    time: 11992309289,
    size: 111112
  }
}
```

#### <a name="ls-stream"></a> `> cacache.ls.stream(cache) -> Readable`

Enumera todas las entradas en el caché, emitiendo un objeto de [`get.info`](#get-info) por cada evento de `data` en el stream.

##### Ejemplo

```javascript
cacache.ls.stream(cachePath).on('data', console.log)
// Output
{
  key: 'my-thing',
  integrity: 'sha512-BaSe64HaSh',
  path: '.testcache/content/deadbeef', // joined with `cachePath`
  time: 12345698490,
  size: 13423,
  metadata: {
    name: 'blah',
    version: '1.2.3',
    description: 'this was once a package but now it is my-thing'
  }
}

{
  key: 'other-thing',
  integrity: 'whirlpool-WoWSoMuchSupport',
  path: '.testcache/content/bada55',
  time: 11992309289,
  size: 498023984029
}

{
  ...
}
```

#### <a name="get-data"></a> `> cacache.get(cache, key, [opts]) -> Promise({data, metadata, integrity})`

Devuelve un objeto con los datos, digesto de integridad y metadata identificados
por la clave `key`. La propiedad `data` de este objeto será una instancia de
`Buffer` con los datos almacenados en el caché.
to do with it! cacache just won't care.

`integrity` es un `string` de [Subresource Integrity](#integrity). Dígase, un
`string` que puede ser usado para verificar a la `data`, que tiene como formato
`<hash-algorithm>-<base64-integrity-hash>`.

So no existe ninguna entrada identificada por `key`, o se los datos almacenados
localmente fallan verificación, el `Promise` fallará.

Una sub-función, `get.byDigest`, tiene casi el mismo comportamiento, excepto que
busca entradas usando el hash de integridad, sin tocar el índice general. Esta
versión *sólo* devuelve `data`, sin ningún objeto conteniéndola.

##### Nota

Esta función lee la entrada completa a la memoria antes de devolverla. Si estás
almacenando datos Muy Grandes, es posible que [`get.stream`](#get-stream) sea
una mejor solución.

##### Ejemplo

```javascript
// Look up by key
cache.get(cachePath, 'my-thing').then(console.log)
// Output:
{
  metadata: {
    thingName: 'my'
  },
  integrity: 'sha512-BaSe64HaSh',
  data: Buffer#<deadbeef>,
  size: 9320
}

// Look up by digest
cache.get.byDigest(cachePath, 'sha512-BaSe64HaSh').then(console.log)
// Output:
Buffer#<deadbeef>
```

#### <a name="get-stream"></a> `> cacache.get.stream(cache, key, [opts]) -> Readable`

Devuelve un [Readable
Stream](https://nodejs.org/api/stream.html#stream_readable_streams) de los datos
almacenados bajo `key`.

So no existe ninguna entrada identificada por `key`, o se los datos almacenados
localmente fallan verificación, el `Promise` fallará.

`metadata` y `integrity` serán emitidos como eventos antes de que el stream cierre.

Una sub-función, `get.stream.byDigest`, tiene casi el mismo comportamiento,
excepto que busca entradas usando el hash de integridad, sin tocar el índice
general. Esta versión no emite eventos de `metadata` o `integrity`.

##### Ejemplo

```javascript
// Look up by key
cache.get.stream(
  cachePath, 'my-thing'
).on('metadata', metadata => {
  console.log('metadata:', metadata)
}).on('integrity', integrity => {
  console.log('integrity:', integrity)
}).pipe(
  fs.createWriteStream('./x.tgz')
)
// Outputs:
metadata: { ... }
integrity: 'sha512-SoMeDIGest+64=='

// Look up by digest
cache.get.stream.byDigest(
  cachePath, 'sha512-SoMeDIGest+64=='
).pipe(
  fs.createWriteStream('./x.tgz')
)
```

#### <a name="get-info"></a> `> cacache.get.info(cache, key) -> Promise`

Busca el `key` en el índice del caché, devolviendo información sobre la entrada
si existe.

##### Campos

* `key` - Clave de la entrada. Igual al argumento `key`.
* `integrity` - [Subresource Integrity hash](#integrity) del contenido al que se refiere esta entrada.
* `path` - Dirección del fichero de datos almacenados, relativa al argumento `cache`.
* `time` - Hora de creación de la entrada
* `metadata` - Metadatos asignados a esta entrada por el usuario

##### Ejemplo

```javascript
cacache.get.info(cachePath, 'my-thing').then(console.log)

// Output
{
  key: 'my-thing',
  integrity: 'sha256-MUSTVERIFY+ALL/THINGS=='
  path: '.testcache/content/deadbeef',
  time: 12345698490,
  size: 849234,
  metadata: {
    name: 'blah',
    version: '1.2.3',
    description: 'this was once a package but now it is my-thing'
  }
}
```

#### <a name="get-hasContent"></a> `> cacache.get.hasContent(cache, integrity) -> Promise`

Busca un [Subresource Integrity hash](#integrity) en el caché. Si existe el
contenido asociado con `integrity`, devuelve un objeto con dos campos: el hash
_específico_ que se usó para la búsqueda, `sri`, y el tamaño total del
contenido, `size`. Si no existe ningún contenido asociado con `integrity`,
devuelve `false`.

##### Ejemplo

```javascript
cacache.get.hasContent(cachePath, 'sha256-MUSTVERIFY+ALL/THINGS==').then(console.log)

// Output
{
  sri: {
    source: 'sha256-MUSTVERIFY+ALL/THINGS==',
    algorithm: 'sha256',
    digest: 'MUSTVERIFY+ALL/THINGS==',
    options: []
  },
  size: 9001
}

cacache.get.hasContent(cachePath, 'sha521-NOT+IN/CACHE==').then(console.log)

// Output
false
```

#### <a name="put-data"></a> `> cacache.put(cache, key, data, [opts]) -> Promise`

Inserta `data` en el caché. El `Promise` devuelto se resuelve con un hash
(generado conforme a [`opts.algorithms`](#optsalgorithms)) después que la
entrada haya sido escrita en completo.

##### Ejemplo

```javascript
fetch(
  'https://registry.npmjs.org/cacache/-/cacache-1.0.0.tgz'
).then(data => {
  return cacache.put(cachePath, 'registry.npmjs.org|cacache@1.0.0', data)
}).then(integrity => {
  console.log('integrity hash is', integrity)
})
```

#### <a name="put-stream"></a> `> cacache.put.stream(cache, key, [opts]) -> Writable`

Devuelve un [Writable
Stream](https://nodejs.org/api/stream.html#stream_writable_streams) que inserta
al caché los datos escritos a él. Emite un evento `integrity` con el hash del
contenido escrito, cuando completa.

##### Ejemplo

```javascript
request.get(
  'https://registry.npmjs.org/cacache/-/cacache-1.0.0.tgz'
).pipe(
  cacache.put.stream(
    cachePath, 'registry.npmjs.org|cacache@1.0.0'
  ).on('integrity', d => console.log(`integrity digest is ${d}`))
)
```

#### <a name="put-options"></a> `> opciones para cacache.put`

La funciones `cacache.put` tienen un número de opciones en común.

##### `opts.metadata`

Metadatos del usuario que se almacenarán con la entrada.

##### `opts.size`

El tamaño declarado de los datos que se van a insertar. Si es proveído, cacache
verificará que los datos escritos sean de ese tamaño, o si no, fallará con un
error con código `EBADSIZE`.

##### `opts.integrity`

El hash de integridad de los datos siendo escritos.

Si es proveído, y los datos escritos no le corresponden, la operación fallará
con un error con código `EINTEGRITY`.

`opts.algorithms` no tiene ningún efecto si esta opción está presente.

##### `opts.algorithms`

Por Defecto: `['sha512']`

Algoritmos que se deben usar cuando se calcule el hash de [subresource
integrity](#integrity) para los datos insertados. Puede usar cualquier algoritmo
enumerado en `crypto.getHashes()`.

Por el momento, sólo se acepta un algoritmo (dígase, un array con exáctamente un
valor). No tiene ningún efecto si `opts.integrity` también ha sido proveido.

##### `opts.uid`/`opts.gid`

Si están presentes, cacache hará todo lo posible para asegurarse que todos los
ficheros creados en el proceso de sus operaciones en el caché usen esta
combinación en particular.

##### `opts.memoize`

Por Defecto: `null`

Si es verdad, cacache tratará de memoizar los datos de la entrada en memoria. La
próxima vez que el proceso corriente trate de accesar los datos o entrada,
cacache buscará en memoria antes de buscar en disco.

Si `opts.memoize` es un objeto regular o un objeto como `Map` (es decir, un
objeto con métodos `get()` y `set()`), este objeto en sí sera usado en vez del
caché de memoria global. Esto permite tener lógica específica a tu aplicación
encuanto al almacenaje en memoria de tus datos.

Si quieres asegurarte que los datos se lean del disco en vez de memoria, usa
`memoize: false` cuando uses funciones de `cacache.get`.

#### <a name="rm-all"></a> `> cacache.rm.all(cache) -> Promise`

Borra el caché completo, incluyendo ficheros temporeros, ficheros de datos, y el
índice del caché.

##### Ejemplo

```javascript
cacache.rm.all(cachePath).then(() => {
  console.log('THE APOCALYPSE IS UPON US 😱')
})
```

#### <a name="rm-entry"></a> `> cacache.rm.entry(cache, key) -> Promise`

Alias: `cacache.rm`

Borra la entrada `key` del índuce. El contenido asociado con esta entrada
seguirá siendo accesible por hash usando [`get.stream.byDigest`](#get-stream).

Para borrar el contenido en sí, usa [`rm.content`](#rm-content). Si quieres
hacer esto de manera más segura (pues ficheros de contenido pueden ser usados
por multiples entradas), usa [`verify`](#verify) para borrar huérfanos.

##### Ejemplo

```javascript
cacache.rm.entry(cachePath, 'my-thing').then(() => {
  console.log('I did not like it anyway')
})
```

#### <a name="rm-content"></a> `> cacache.rm.content(cache, integrity) -> Promise`

Borra el contenido identificado por `integrity`. Cualquier entrada que se
refiera a este contenido quedarán huérfanas y se invalidarán si se tratan de
accesar, al menos que contenido idéntico sea añadido bajo `integrity`.

##### Ejemplo

```javascript
cacache.rm.content(cachePath, 'sha512-SoMeDIGest/IN+BaSE64==').then(() => {
  console.log('data for my-thing is gone!')
})
```

#### <a name="set-locale"></a> `> cacache.setLocale(locale)`

Configura el lenguaje usado para mensajes y errores de cacache. La lista de
lenguajes disponibles está en el directorio `./locales` del proyecto.

_Te interesa añadir más lenguajes? [Somete un PR](CONTRIBUTING.md)!_

#### <a name="clear-memoized"></a> `> cacache.clearMemoized()`

Completamente reinicializa el caché de memoria interno. Si estás usando tu
propio objecto con `opts.memoize`, debes hacer esto de manera específica a él.

#### <a name="tmp-mkdir"></a> `> tmp.mkdir(cache, opts) -> Promise<Path>`

Devuelve un directorio único dentro del directorio `tmp` del caché.

Una vez tengas el directorio, es responsabilidad tuya asegurarte que todos los
ficheros escrito a él sean creados usando los permisos y `uid`/`gid` concordante
con el caché. Si no, puedes pedirle a cacache que lo haga llamando a
[`cacache.tmp.fix()`](#tmp-fix). Esta función arreglará todos los permisos en el
directorio tmp.

Si quieres que cacache limpie el directorio automáticamente cuando termines, usa
[`cacache.tmp.withTmp()`](#with-tpm).

##### Ejemplo

```javascript
cacache.tmp.mkdir(cache).then(dir => {
  fs.writeFile(path.join(dir, 'blablabla'), Buffer#<1234>, ...)
})
```

#### <a name="with-tmp"></a> `> tmp.withTmp(cache, opts, cb) -> Promise`

Crea un directorio temporero con [`tmp.mkdir()`](#tmp-mkdir) y ejecuta `cb` con
él como primer argumento. El directorio creado será removido automáticamente
cuando el valor devolvido por `cb()` se resuelva.

Las mismas advertencias aplican en cuanto a manejando permisos para los ficheros
dentro del directorio.

##### Ejemplo

```javascript
cacache.tmp.withTmp(cache, dir => {
  return fs.writeFileAsync(path.join(dir, 'blablabla'), Buffer#<1234>, ...)
}).then(() => {
  // `dir` no longer exists
})
```

#### <a name="integrity"></a> Digestos de Subresource Integrity

cacache usa strings que siguen la especificación de [Subresource Integrity spec](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity).

Es decir, donde quiera cacache espera un argumento o opción `integrity`, ese
string debería usar el formato `<hashAlgorithm>-<base64-hash>`.

Una variación importante sobre los digestos que cacache acepta es que acepta el
nombre de cualquier algoritmo aceptado por el proceso de Node.js donde se usa.
Puedes usar `crypto.getHashes()` para ver cuales están disponibles.

##### Generando tus propios digestos

Si tienes un `shasum`, en general va a estar en formato de string hexadecimal
(es decir, un `sha1` se vería como algo así:
`5f5513f8822fdbe5145af33b64d8d970dcf95c6e`).

Para ser compatible con cacache, necesitas convertir esto a su equivalente en
subresource integrity. Por ejemplo, el hash correspondiente al ejemplo anterior
sería: `sha1-X1UT+IIv2+UUWvM7ZNjZcNz5XG4=`.

Puedes usar código así para generarlo por tu cuenta:

```javascript
const crypto = require('crypto')
const hashAlgorithm = 'sha512'
const data = 'foobarbaz'

const integrity = (
  hashAlgorithm +
  '-' +
  crypto.createHash(hashAlgorithm).update(data).digest('base64')
)
```

También puedes usar [`ssri`](https://npm.im/ssri) para deferir el trabajo a otra
librería que garantiza que todo esté correcto, pues maneja probablemente todas
las operaciones que tendrías que hacer con SRIs, incluyendo convirtiendo entre
hexadecimal y el formato SRI.

#### <a name="verify"></a> `> cacache.verify(cache, opts) -> Promise`

Examina y arregla tu caché:

* Limpia entradas inválidas, huérfanas y corrompidas
* Te deja filtrar cuales entradas retener, con tu propio filtro
* Reclama cualquier ficheros de contenido sin referencias en el índice
* Verifica integridad de todos los ficheros de contenido y remueve los malos
* Arregla permisos del caché
* Remieve el directorio `tmp` en el caché, y todo su contenido.

Cuando termine, devuelve un objeto con varias estadísticas sobre el proceso de
verificación, por ejemplo la cantidad de espacio de disco reclamado, el número
de entradas válidas, número de entradas removidas, etc.

##### Opciones

* `opts.uid` - uid para asignarle al caché y su contenido
* `opts.gid` - gid para asignarle al caché y su contenido
* `opts.filter` - recibe una entrada como argumento. Devuelve falso para removerla. Nota: es posible que esta función sea invocada con la misma entrada más de una vez.

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

Devuelve un `Date` que representa la última vez que `cacache.verify` fue
ejecutada en `cache`.

##### Example

```javascript
cacache.verify(cachePath).then(() => {
  cacache.verify.lastRun(cachePath).then(lastTime => {
    console.log('cacache.verify was last called on' + lastTime)
  })
})
```
