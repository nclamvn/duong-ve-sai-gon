<!-- url: https://github.com/dgreenheck/ez-tree ; https://raw.githubusercontent.com/dgreenheck/ez-tree/main/src/lib/enums.js ; https://raw.githubusercontent.com/dgreenheck/ez-tree/main/LICENSE | fetched_at: 2026-10-10T01:34:00Z | via WebFetch verbatim-extract (three fetches concatenated under headings) -->
## README (github.com/dgreenheck/ez-tree)
"Procedural tree generator written with JavaScript and Three.js"
"EZ-Tree is a procedural tree generator with dozens of tunable parameters."
"MIT license"
"there is a standalone web app which allows you to create trees within the browser and export as .PNG or .GLB files."
"Defines the type of the tree, which can be set to one of the options from the `TreeType` enumeration"
"Specifies the type of leaf texture, selected from the `LeafType` enumeration (e.g., `LeafType.Oak`)."
"Specifies the type of bark texture to use, selected from the `BarkType` enumeration (e.g., `BarkType.Oak`)."
"npm i @dgreenheck/ez-tree"
"https://eztree.dev"

The page does not include any texture or asset licensing information.

## src/lib/enums.js
```javascript
export const Billboard = {
  Single: 'single',
  Double: 'double',
};

export const TreeType = {
  Deciduous: 'deciduous',
  Evergreen: 'evergreen',
};
```

Note: The file does not contain `BarkType` or `LeafType`, so I could not copy them.

## LICENSE
MIT License

Copyright (c) 2024 Daniel Greenheck

Permission is hereby granted, free of charge, to any person obtaining a copy
