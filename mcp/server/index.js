#!/usr/bin/env node
'use strict';
// Entry point. Starts unconditionally: Claude desktop loads this file from its own bootstrap,
// so a `require.main === module` guard never fires there and the server would stay silent.
require('./lib.js').main();
