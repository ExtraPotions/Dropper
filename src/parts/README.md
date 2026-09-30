# Dropper source parts

Dropper's source is split into ordered files in this folder. `npm run build` joins them, in
file-name order and without changing a byte, into `src/dropper.user.js`, then builds the
installable `dropper.user.js`.

- **Edit the parts, not `src/dropper.user.js`.** That file is generated. `npm run build:check`
  fails if it is out of date.
- **Order matters.** Every part runs inside one shared function, so a part may only use names
  defined in earlier parts. Function declarations are available everywhere.
- **Numbers run 00, 01, 02... with no gaps.** Add a feature as a new numbered file, or place it
  next to the code it extends.
- **The version and release notes live in the first part, `00-setup-and-state.js`.** The release
  scripts edit whichever file sorts first, so keep the userscript header, `APP_VERSION`, and
  `RELEASE_NOTES` there.
