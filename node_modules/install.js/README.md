# install.js

## An insane solution to an inane problem

It doesn’t really contribute to the future sanity of the node packaging
environment, but when the node packaging environment becomes more sane
(hopefully, eventually, we will see the day!), install.js won’t be useful
anymore.

TL;DR: It’s a hack.

## What it does
### Install a package from npm globally by symlinking it from your user folder

You should only use install.js if you know that you want to use it.

As in, if you know that you want:

  * To install a script globally
  * Without installing it directly to /usr/local
  * By placing its installation files in a directory on your home folder

It’s a pretty specific use case, and most users will never want for more
than just a regular `npm install -g` that places all their modules in the
same location. But if there are specific modules you’d like to symlink from
elsewhere (say, to save space on the drive your OS is mounted on), it can
help.

### Hey, there’s a bunch of weird output over here

Because it’s fairly difficult to tell whether an install and link works
correctly, install.js will warn you when it isn’t sure if a step succeeded.
For instance, `npm i` can give some pretty scary output even when it works
100% correctly. So install.js will dutifully relay that output, then attempt
to keep going anyway.

That’s because when you’re installing packages and you aren’t npm, you kinda
just try a few things and hope one works. There’s seemingly no rhyme or
reason sometimes to why a package gives an error during installation, and
it’s fairly hard to tell, for instance, if `npm link` does the work of `lnbin`
for it, so install.js just tries everything and lets you know when those things
(sometimes incorrectly) report that they have failed.

### Why use install.js instead of symlinking the entire node\_modules directory?

Because symlinking the entire node\_modules directory can have some really
weird side effects with certain packages. (This is speaking from experience.)

### Usage

```bash

$ install.js yo

call registryGet
GET http://registry.npmjs.org/yo
call tarballDownload
tar download
pipe out to /tmp/***
call extractTarball
...
# (etc.)

$ yo

? ‘Allo, User! What would you like to do? (Use arrow keys)
...
# (etc.)

```

