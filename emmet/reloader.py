import sys
import imp

# Dependecy reloader for Emmet plugin
# The original idea is borrowed from 
# https://github.com/wbond/sublime_package_control/blob/master/package_control/reloader.py 

reload_mods = []
for mod in sys.modules:
	if mod.startswith('emmet') and sys.modules[mod] != None:
		reload_mods.append(mod)

mods_load_order = [
	'emmet.semver',
	'emmet.pyv8loader',
	'emmet_completions.trackers',
	'emmet_completions.meta',
	'emmet_completions',
	'emmet.file',
	'emmet.context'
]

for mod in mods_load_order:
	if mod in reload_mods:
		m = sys.modules[mod]
		if 'on_module_reload' in m.__dict__:
			m.on_module_reload()
		imp.reload(sys.modules[mod])