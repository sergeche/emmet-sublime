# Emmet (ex-Zen Coding) for Sublime Text 2 plugin

A work-in-progress official plugin for Sublime Text 2 with upcoming Emmet toolkit, previously called Zen Coding. This plugin will eventually replace current plugin: https://github.com/sublimator/ZenCoding

*Warning:* this plugin may not work at all in some OSes since it written in JavaScript and uses [PyV8](http://code.google.com/p/pyv8/) and [Google V8](https://developers.google.com/v8/) binaries to run. These binaries must be compiled individually for every OS.

## How to install

1. Clone git repo into your packages folder (in ST2, find Browse Packages... menu item to open this folder)
2. Restart ST2 editor

Or with package control:

1. Package Control: Add Repository `https://github.com/sergeche/emmet-sublime`
2. Package Control: Install Package `emmet-sublime`
3. Restart ST2 editor

You should remove or disable previous Zen Coding plugin, installed from Package Control, in order to operate properly.

## Things to test

Emmet is not announced yet, but you can get a quick look at new features and help me test and improve them.

### CSS

Emmet features advanced CSS support:

* You can write numeric values (optionally with units) directly into abbreviation: `p10` → `padding: 10px`, `m0.5-10--15` → `margin: 0.5em 10px -15px`, `w100p` → `width: 100%`. Integer and float values are automatically suffixed with `px` and `em` units respectively.
* Abbreviations prefixed with dash will automatically produce vendor-prefixed CSS properties. For example: `bdrs` will produce `border-radius` property, but `-bdrs` will produce a list of properties with `webkit`, `moz`, `ms` and `o` prefixes.
* Gradient generator: write gradient definition (`linear-gradient(...)` or simply `lg(...)`) as a value for any CSS property and run “Expand Abbreviation” action (or simply hit Tab key) to get a vendor-prefixed list gradient definitions.
* Unknown abbreviations are no longer expanded to HTML tags (e.g. `foo` → `<foo></foo>`), they are expanded into CSS properties: `foo` → `foo: ;`.

You can see more examples in unit tests:
* [CSS Resolver](https://github.com/sergeche/zen-coding/blob/v0.7.1/javascript/unittest/tests/css-resolver.js)
* [CSS Gradients](https://github.com/sergeche/zen-coding/blob/v0.7.1/javascript/unittest/tests/cssGradient.js)

### Yandex BEM filter

You you’re writing your HTML and CSS code in OOCSS-style, [Yandex’s BEM](http://coding.smashingmagazine.com/2012/04/16/a-new-front-end-methodology-bem/) style specifically, you will like this filter. It provides some aliases and automatic insertions of common block and element names in classes. For example: `.block_mod.-elem|bem` is the same abbreviation as `.block.block_mod>.block__elem`. More examples in [unit tests](https://github.com/sergeche/zen-coding/blob/v0.7.1/javascript/unittest/tests/filters.js#L19).

If you’re writing a lot of BEM code, you may want to make `bem` filter default for `html` syntax (see `Emmet.sublime-settings`).

### Misc

* Better Tab key handling.
* Many aspects of Emmet core can be configured in `Emmet.sublime-settings` file: create a copy of this file into ST2’ _Users_ folder and put there you snippets, preferences, output profiles etc.
* “Lorem ipsum” generator: just expand `lorem` or `lipsum` abbreviation (optionally with number suffix, indicating word count: `lorem10`) to generate random sentences. More examples in [unit tests](https://github.com/sergeche/zen-coding/blob/v0.7.1/javascript/unittest/tests/generators.js). 
* Implicit tag names: you don’t need to write tag names for most common structures, Emmet will resolve them for you depending on parent’s tag name. Check out these abbreviations: `.test`, `em>.test`, `ul>.item*3`, `table>.row$*2>.cell$*3`.
* New operator to climb one level up: `^`. Check out these abbreviations: `.header>.nav^.logo`,  `.header>.wrap>.nav^^.logo`.
* Extensions support: you can easily extend Emmet with new actions and filters or customize existing ones. In `Emmet.sublime-settings`, define `extensions_path` setting and Emmet will load all `.js` and `.json` files in specified folder at startup.
