This is a Sublime Text plugin repo so post here only ST-related issues. If you found a bug in how Emmet works (for example, invalid result after expanding abbreviation) or have a proposal for a new features, please post them on core [Emmet repo](https://github.com/emmetio/emmet).

## About keyboard shortcuts

A lot of people complain about Emmet shortcuts overriding some default ST actions or actions from other plugins.

As described in [README](README.md), it’s nearly impossible to provide shortcuts that will not override anything and will be convenient for everyone. So default Emmet shortcuts are ones that I’m personally happy with. If you don’t like them, please spend 2 minutes for tweaking shortcuts, as [described in README](README.md#overriding-keyboard-shortcuts).

All issues about shortcuts will be rejected. If you have a better shortcut for Emmet actions, you should create a Pull Request with updated `*.sublime-keymap` and `misc/generate-keymap.py` files. Note that the last one is used to generate all `*.sublime-keymap` files.