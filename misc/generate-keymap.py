import os.path
import json
import copy

import collections

try:                basestring
except NameError:   basestring = str

class O(str): pass

class R(O):
	key="replaces"
	def __repr__(self):
		return "%s(%s)" % (type(self).__name__, str.__repr__(self))
	def __deepcopy__(self, val):
		return self

class E(O):
	key="enhances"

class RU(O):
	key="replaces_infrequent"

keymap = {
	"expand_abbreviation": RU("ctrl+e"),
	"match_pair_outward": {"mac": "ctrl+d", "pc": "ctrl+,"},
	"match_pair_inward": {"mac": "ctrl+j", "pc": "ctrl+shift+0"},
	"matching_pair": {"mac": "ctrl+shift+t", "pc": "ctrl+alt+j"},
	"next_edit_point": "ctrl+alt+right",
	"prev_edit_point": "ctrl+alt+left",
	"toggle_comment": {
		"mac": E("super+shift+forward_slash"),
		"pc": E("ctrl+shift+forward_slash"),
		"context": [{
			"key": "selector", 
			"operand": "source.css - source.css.less, text.xml, text.html",
			"operator": "equal"
		}]
	},
	"split_join_tag": {"mac": "shift+super+'", "pc": "shift+ctrl+`"},
	"remove_tag": {"mac": "super+'", "pc": "shift+ctrl+;"},
	"evaluate_math_expression": {"mac": "shift+super+y", "pc": "shift+ctrl+y"},
	"increment_number_by_1": R("ctrl+up"),
	"decrement_number_by_1": R("ctrl+down"),
	"increment_number_by_01": "alt+up",
	"decrement_number_by_01": "alt+down",
	"increment_number_by_10": {"mac": "alt+super+up", "pc": R("shift+alt+up")},
	"decrement_number_by_10": {"mac": "alt+super+down", "pc": R("shift+alt+down")},
	"select_next_item": {"mac": "shift+super+.", "pc": "shift+ctrl+."},
	"select_previous_item": {"mac": "shift+super+,", "pc": "shift+ctrl+,"},
	"reflect_css_value": {"mac": "shift+super+r", "pc": R("shift+ctrl+r")},
	"rename_tag": {"mac": "super+shift+k", "pc": "shift+ctrl+'"},
	"encode_decode_data_url": {"mac": "shift+ctrl+d", "pc": "ctrl+'"},
	"update_image_size": {"mac": "shift+ctrl+i", "pc": R("ctrl+u")},

	"expand_as_you_type": {
		"keys": ["ctrl+alt+enter"],
		"context": [{
			"key": "setting.is_widget", 
			"operand": False, 
			"operator": "equal"
		}]
	},

	"wrap_as_you_type": {
		"mac": "ctrl+w", 
		"pc": R("shift+ctrl+g"),
		"context": [{
			"key": "setting.is_widget", 
			"operand": False, 
			"operator": "equal"
		}]
	}
}

# additional "raw" ST2 actions definition
addon = [
	{
		"keys": ["tab"],
		"command": "expand_abbreviation_by_tab",
		"context": [
			{
				"key": "selector",
				"match_all": True,
				"operand": "source.css, source.sass, source.less, source.scss, source.stylus, text.xml, text.html, text.haml, text.scala.html, source string",
				"operator": "equal"
			}, {
				"key": "selector",
				"operand": "text.html source.php, storage.type.templatetag.django",
				"operator": "not_equal",
				"match_all": True
			}, {
				"key": "selection_empty",
				"match_all": True
			}, {
				"key": "has_next_field",
				"operator": "equal",
				"operand": False,
				"match_all": True
			}, {
				"key": "setting.disable_tab_abbreviations",
				"operator": "equal",
				"operand": False,
				"match_all": True
			}, {
				"key": "auto_complete_visible",
				"operand": False,
				"operator": "equal",
				"match_all": True
			}, {
				"key": "is_abbreviation",
				"match_all": True
			}
		]
	},

	# behaviour of tab key when autocomplete popup is visible
	{
		"keys": ["tab"],
		"command": "expand_abbreviation_by_tab",
		"context": [
			{
				"key": "selector",
				"match_all": True,
				"operand": "source.css, source.sass, source.less, source.scss, source.stylus, text.xml, text.html, text.haml, text.scala.html, source string",
				"operator": "equal"
			}, {
				"key": "selector",
				"operand": "text.html source.php, storage.type.templatetag.django",
				"operator": "not_equal",
				"match_all": True
			}, {
				"key": "selection_empty",
				"match_all": True
			}, {
				"key": "has_next_field",
				"operator": "equal",
				"operand": False,
				"match_all": True
			}, {
				"key": "auto_complete_visible",
				"operator": "equal",
				"operand": True,
				"match_all": True
			}, {
				"key": "setting.disable_tab_abbreviations_on_auto_complete",
				"operator": "equal",
				"operand": False,
				"match_all": True
			}, {
				"key": "is_abbreviation",
				"match_all": True
			}
		]
	}, 

	# insert linebreak with formatting
	{
		"__doc__": "insert linebreak with formatting",
		"keys": [E("enter")],
		"command": "insert_snippet",
		"args": {"contents": "\n\t${0}\n"},
		"context": [
			{
				"key": "selector",
				"operand": "meta.scope.between-tag-pair.html, meta.scope.between-tag-pair.xml", 
				"match_all": True
			}, {
				"key": "auto_complete_visible",
				"operand": False, 
				"match_all": True
			}, {
				"key": "clear_fields_on_enter_key",
				"match_all": True
			}, {
				"key": "setting.disable_formatted_linebreak",
				"operand": False,
				"match_all": True
			}
		]
	},

	{
		"keys": ["#"],
		"command": "emmet_insert_attribute",
		"args": {"attribute": "id"},
		"context": [
			{
				"key": "selector",
				"match_all": True,
				"operand": "text.html meta.tag -string -punctuation.definition.tag.begin.html -meta.scope.between-tag-pair.html -source -meta.tag.template.value.twig",
				"operator": "equal"
			}, {
				"key": "setting.auto_id_class",
				"operator": "equal",
				"operand": True
			}
		]
	},

	{
		"keys": ["."],
		"command": "emmet_insert_attribute",
		"args": {"attribute": "class"},
		"context": [
			{
				"key": "selector",
				"match_all": True,
				"operand": "text.html meta.tag -string -punctuation.definition.tag.begin.html -meta.scope.between-tag-pair.html -source -meta.tag.template.value.twig",
				"operator": "equal"
			}, {
				"key": "setting.auto_id_class",
				"operator": "equal",
				"operand": True
			}
		]
	}
]

# header of generated file
header = "// This file is automatically generated with misc/generate-keymap.py script\n\n"

_dir = os.path.dirname(os.path.abspath(__file__))

standalone_actions = ["wrap_as_you_type", "expand_as_you_type", "rename_tag"]

def create_record(k, v, os_type):
	if isinstance(v, (basestring, O)):
		v = {"keys": [v]}
	else:
		v = copy.deepcopy(v)

	if os_type in v:
		v['keys'] = [v[os_type]]

	if 'pc' in v:
		del v['pc']

	if 'mac' in v:
		del v['mac']

	if k in standalone_actions:
		v['command'] = k
	else:
		v['command'] = 'run_emmet_action'
		v['args'] = {"action": k}

	if 'context' not in v:
		v['context'] = []

	ctx = {'key': 'emmet_action_enabled.%s' % k}
	
	keys = v['keys'][0]
	if isinstance(keys, O): ctx['key'] += ('.%s_default' %  type(keys).key)
	v['context'].append(ctx)

	if len(v['context']) > 1:
		for ctx in v['context']:
			ctx['match_all'] = True

	return v

def generate_override_header(editor_keymap):
	overrides = collections.defaultdict(list)

	header = []
	H= lambda s='': header.append('// ' +  s)
	for v in editor_keymap:
		for b in v['keys']:
			if isinstance(b, O):
				overrides[type(b).key].append(v)

	def get_command(b):
		if '__doc__' in b:
			cmd  = b['__doc__']
		else:
			cmd = b['command']
			if cmd == 'run_emmet_action':
				cmd = b['args']['action']
		return cmd

	for k, v in sorted(overrides.items()):
		v = sorted(v, key=lambda i: i['keys'][0])

		header_mapping = dict (
			replaces = 'default bindings',
			replaces_infrequent = 'infreqently used default bindings',
			enhances = 'default bindings, enhancing same function ')

		H(("(%s) Overrides of " + header_mapping[k]) % k)
		H()
		for b in v:
			H('   %-40s : %s' %  (get_command(b), b['keys'][0]) )
		H()

	return '\n'.join(header) + '\n'

def generate_keymap_file(path):
	os_type = 'mac' if '(OSX)' in path else 'pc'
	path = os.path.abspath(os.path.join(_dir, path))
	print('Generate %s (%s)' % (path, os_type))

	editor_keymap = [create_record(k, v, os_type) for k, v in keymap.items()] + addon
	content = json.dumps(editor_keymap, indent=4)
	f = open(path, 'w')
	f.write(header + generate_override_header(editor_keymap) + content)
	f.close()

for path in ['../Default (OSX).sublime-keymap', '../Default (Windows).sublime-keymap', '../Default (Linux).sublime-keymap']:
	generate_keymap_file(path)


