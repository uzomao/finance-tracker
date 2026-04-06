// Backwards-compat wrapper around the new global config module.
//
// Historically this file controlled whether Firebase or IndexedDB was used
// as the primary data source. The app now always uses IndexedDB as the
// primary store and treats Firebase as an optional background sync target.
//
// We still expose USE_FIREBASE here so any older imports continue to work.

import { USE_FIREBASE } from '../config';

export { USE_FIREBASE };
