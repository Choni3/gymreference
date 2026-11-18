three.js r187 (https://threejs.org, MIT, see LICENSE).

`three.module.min.js` is the official `build/three.module.js` from the npm package
`three@0.187.0`, bundled with its `three.core.js` into one file and minified:

    npx esbuild node_modules/three/build/three.module.js --bundle --minify --format=esm --legal-comments=inline --outfile=three.module.min.js

Loaded lazily by js/motion/player.js only when an exercise's Animation section is shown.
