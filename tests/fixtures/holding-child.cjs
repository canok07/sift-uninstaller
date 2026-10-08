// Harmless launcher fixture: no Registry, uninstall command or user files.
const fs = require('node:fs');
const release = process.argv[2];
if (!release) process.exit(2);
const poll = setInterval(() => { if (fs.existsSync(release)) { clearInterval(poll); process.exit(0); } }, 100);
// Bounded lifetime even if the test parent fails. Never needs a forced kill.
setTimeout(() => process.exit(0), 40000);
