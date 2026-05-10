#! /usr/bin/env node
var https     = require('https')
  , fs        = require('fs')
  , path      = require('path')
  , exec      = require('child_process').exec
  , chalk     = require('chalk')
  , tmp       = require('tmp').fileSync
  , userhome  = require('userhome')
  , mkdirp    = require('mkdirp')
  , targz     = require('tar.gz')

  , name      = process.argv[process.argv.length - 1]
  , reg       = 'https://registry.npmjs.org'
  , tarurl    = ''
  , installjs = userhome('.install.js')
  , dest      = installjs + '/' + name
  , tarball   = tmp({ keep: true })

// GENERAL
function pr () {
  console.log.apply(console, arguments)
}

// EXEC util
function handleExec (then, talkative=false) {
  return function (error, stdout, stderr) {
    if (! error) {
      pr(chalk.white(' > Executing', chalk.dim.white('done')))
      pr()
      then()
    } else {
      pr(chalk.red(' > exec apparent'), chalk.bold.inverse.red('FAIL'))
      if (talkative) {
        var printError = String(error)
          .split('\n')
          .slice(0, -1)
          .map(function (line) {
            return chalk.dim.red('   -->') + ' ' + line
          })
          .join('\n')
        pr(chalk.red(printError))
      }
      pr(chalk.yellow('Attempting to continue...'))
      then()
    }
  }
}

function exc (cmd, where, then) {
  if (!then) then = where, where = process.cwd()

  pr()
  pr(' >', chalk.white('Executing', chalk.dim.white(cmd), 'at', chalk.dim.white(where) + '...'))
  pr(' >', chalk.white('Then', chalk.dim.white(then)))

  var child = exec(cmd, { cwd: where, maxBuffer: 1024 * 1024 * 500 }, handleExec(then))

  child.stdout.on('data', function (data) {
    if (data.length)
      pr('  >', chalk.gray(data.replace('\n', '')))
  })

  child.stderr.on('data', function (data) {
    if (data.length)
      pr('  >', chalk.gray(data.replace('\n', '')))
  })
}

// REQ util
function breq (url, then) {
  return https.get(url, function (res) {
    if ( res.statusCode == 200 )
      then(res)
    else {
      pr(chalk.inverse.red('request fail:'),
         chalk.red('url ', url, 'could not be accessed (code: ' + res.statusCode + ')'))
    }
  })
}

function drain (stream, then) {
  var body = ''

  stream.on('data', function (chunk) {
    body += chunk
  })

  stream.on('end', function () {
    then(body)
  })
}

// REQs
function getPackageData (name) {
  return function registryGet (done) {
    pr(chalk.gray('GET', reg + '/' + name))
    breq(reg + '/' + name, function (res) {
      drain(res, function (body) {
        var deets  = JSON.parse(body)
          , latest = deets['dist-tags'].latest
        tarurl = deets.versions[latest].dist.tarball
        done()
      })
    })
  }
}

function tarballDownload (done) {
  pr(chalk.gray('tar download'))
  breq(tarurl, function (res) {
    // dump the output
    var out = fs.createWriteStream(tarball.name)
    pr(chalk.gray('pipe out to', tarball.name))
    res.pipe(out).on('finish', done)
  })
}

// PROCESSING
function extractTarball (done) {
  targz().extract(tarball.name, dest)
    .then(function () {
      pr(chalk.gray('Extracted'))
      // Disgusting. But necessary.
      setTimeout(done, 100)
    })
    .catch(function (err) {
      pr(chalk.red('Extract FAIL'))
    })
}

function mvFromPackage (done) {
  exc('mv package/* .', dest, done)
}

function rmOldPackage (done) {
  exc('rm -rf package', dest, done)
}

function npmi (done) {
  exc('npm i -d', dest, done)
}

function npmln (done) {
  exc('npm link', dest, done)
}

// npm takes care of this for you, but only sometimes
// you just can't trust anybody
function lnbinHelper (bin) {
  return function (done) {
    var lnk    = path.join(dest, bin)
      , exists = fs.existsSync(lnk)

    if (!exists) {
      exc('ln -s ' + lnk + ' ' + path.join('/usr/local/bin/', name), done)
    } else {
        pr(chalk.gray('Bin already ln?'))
        done()
    }
  }
}

function lnbin (done) {
  var bin = require(dest + '/package.json').bin

  if (bin) {
    let bins = []
    if (typeof bin === 'string') {
      bins = [ bin ]
    } else {
      bins = Object.keys(bin)
    }

    chain(bins.map(lnbinHelper), done)
  } else {
    pr(chalk.gray('No bin to ln'))
    done()
  }
}

// UTIL
function chain (fns, complete) {
  var fin = 0, count = fns.length

  function done () {
    fin++
    if (fin != count) {
      pr(chalk.green(((fin / count)*100|0) + '%'))
      next()
    } else if (complete) {
      pr(chalk.green('Done'))
      pr(chalk.green('...'))
      pr(chalk.green('💰 ?'))
      complete()
    }
  }

  function next () {
    var fn = fns.shift()
    console.log('call', fn.name)
    fn.call(null, done)
  }

  next()
}

// MAIN
mkdirp(installjs, function (err) {
  if (err) {
    console.log(err)
    pr(chalk.yellow('.install.js found'))
  }
})

chain([
  getPackageData(name),
  tarballDownload,
  extractTarball,
  mvFromPackage,
  rmOldPackage,
  npmi,
  npmln,
  lnbin
])
