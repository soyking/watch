#!/usr/bin/env node

var argv = require('minimist')(process.argv.slice(2))
var execshell = require('exec-sh')
var path = require('path')
var watch = require('./main.js')

if(argv._.length === 0) {
  console.error([
    'Usage: watch <command> [...directory]',
    '[--wait=<seconds>]',
    '[--filter=<file>]',
    '[--interval=<seconds>]',
    '[--ignoreDotFiles]',
    '[--ignoreUnreadable]',
    '[--ignoreDirectoryPattern]',
    '[--killCommand]',
    '[--killSignal]',
    '[--rerunTimeout]'
  ].join(' '))
  process.exit()
}

var watchTreeOpts = {}
var command = argv._[0]
var dirs = []

var i
var argLen = argv._.length
if (argLen > 1) {
  for(i = 1; i< argLen; i++) {
      dirs.push(argv._[i])
  }
} else {
  dirs.push(process.cwd())
}

var waitTime = Number(argv.wait || argv.w)
if (argv.interval || argv.i) {
  watchTreeOpts.interval = Number(argv.interval || argv.i || 0.2);
}

if(argv.ignoreDotFiles || argv.d)
  watchTreeOpts.ignoreDotFiles = true

if(argv.ignoreUnreadable || argv.u)
  watchTreeOpts.ignoreUnreadableDir = true

if(argv.ignoreDirectoryPattern || argv.p) {
  var match = (argv.ignoreDirectoryPattern || argv.p).match(/^\/(.*)\/([gimuy]*)$/);
  watchTreeOpts.ignoreDirectoryPattern = new RegExp(match[1], match[2])
}

var killCommand = false
if(argv.killCommand || argv.k) {
  killCommand = true
}

var killSignal = "SIGHUP"
if(argv.killSignal || argv.s) {
  killSignal = argv.killSignal || argv.s
}

var rerunTimeout = Number(argv.rerunTimeout || argv.r)

if(argv.filter || argv.f) {
  try {
    watchTreeOpts.filter = require(path.resolve(process.cwd(), argv.filter || argv.f))
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

var wait = false

var dirLen = dirs.length
var skip = dirLen - 1
var child = null
var childHasExit = false

function run_child(command) {
  child = execshell(command)
  child.on("exit", () => {
    childHasExit = true
  })
  return child
}

for(i = 0; i < dirLen; i++) {
  var dir = dirs[i]
  console.error('> Watching', dir)
  watch.watchTree(dir, watchTreeOpts, function (f, curr, prev) {
    if(skip) {
        skip--
        return
    }
    if(wait) return

    if (killCommand) {
      if (child && !childHasExit) {
        // stop previous child and fun 
        child.removeAllListeners()
        child.on("exit", () => {
          setTimeout(() => child = run_child(command), rerunTimeout * 1000)
        })
        child.kill(killSignal)
      } else {
        // run at first time or previous child has exited
        child = run_child(command)
        childHasExit = false
      }
    } else {
      execshell(command)
    }

    if(waitTime > 0) {
      wait = true
      setTimeout(function () {
        wait = false
      }, waitTime * 1000)
    }
  })
}
