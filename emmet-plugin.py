import sublime
import sublime_plugin

import re
import imp
import json
import sys
import os.path
import traceback

BASE_PATH = os.path.abspath(os.path.dirname(__file__))
PACKAGES_PATH = sublime.packages_path() or os.path.dirname(BASE_PATH)
# EMMET_GRAMMAR = os.path.join(BASE_PATH, 'Emmet.tmLanguage')
EMMET_GRAMMAR = 'Packages/%s/Emmet.tmLanguage' % os.path.basename(BASE_PATH).replace('.sublime-package', '')
sys.path += [BASE_PATH] + [os.path.join(BASE_PATH, f) for f in ['emmet_completions', 'emmet']]


# Make sure all dependencies are reloaded on upgrade
if 'emmet.reloader' in sys.modules:
	imp.reload(sys.modules['emmet.reloader'])
import emmet.reloader

# import completions as cmpl
import emmet.pyv8loader as pyv8loader
import emmet_completions as cmpl
from emmet_completions.meta import HTML_ELEMENTS_ATTRIBUTES, HTML_ATTRIBUTES_VALUES
from emmet.context import Context
from emmet.context import js_file_reader as _js_file_reader
from emmet.pyv8loader import LoaderDelegate

__version__      = '1.2'
__core_version__ = '1.1'
__authors__      = ['"Sergey Chikuyonok" <serge.che@gmail.com>'
					'"Nicholas Dudfield" <ndudfield@gmail.com>']

is_python3 = sys.version_info[0] > 2

# JS context
ctx = None
# Emmet Settings
settings = None

# Default ST settings
user_settings = None

def is_st3():
	return sublime.version()[0] == '3'

def js_file_reader(file_path, use_unicode=True):
	if hasattr(sublime, 'load_resource'):
		rel_path = file_path
		for prefix in [sublime.packages_path(), sublime.installed_packages_path()]:
			if rel_path.startswith(prefix):
				rel_path = os.path.join('Packages', rel_path[len(prefix) + 1:])
				break

		rel_path = rel_path.replace('.sublime-package', '')
		# for Windows we have to replace slashes
		rel_path = rel_path.replace('\\', '/')
		return sublime.load_resource(rel_path)

	return _js_file_reader(file_path, use_unicode)

def init():
	"Init Emmet plugin"
	# load settings
	globals()['user_settings'] = sublime.load_settings('Preferences.sublime-settings')
	globals()['settings'] = sublime.load_settings('Emmet.sublime-settings')
	settings.add_on_change('extensions_path', update_settings)

	# setup environment for PyV8 loading
	pyv8_paths = [
		os.path.join(PACKAGES_PATH, 'PyV8'),
		os.path.join(PACKAGES_PATH, 'PyV8', pyv8loader.get_arch()),
		os.path.join(PACKAGES_PATH, 'PyV8', 'pyv8-%s' % pyv8loader.get_arch())
	]

	sys.path += pyv8_paths

	# unpack recently loaded binary, is exists
	for p in pyv8_paths:
		pyv8loader.unpack_pyv8(p)
	
	# provide some contributions to JS
	contrib = {
		'sublime': sublime, 
		'sublimeReplaceSubstring': replace_substring,
		'sublimeGetOption': settings.get
	}

	# detect extensions path
	ext_path = settings.get('extensions_path', None)
	if ext_path:
		ext_path = os.path.expanduser(ext_path)
		if not os.path.isabs(ext_path):
			ext_path = os.path.normpath(os.path.join(sublime.packages_path(), ext_path))

	# create JS environment
	delegate = SublimeLoaderDelegate()
	globals()['ctx'] = Context(
		files=['../editor.js'], 
		ext_path=ext_path, 
		contrib=contrib, 
		logger=delegate.log,
		reader=js_file_reader
	)

	update_settings()

	if not settings.get('disable_pyv8_update', False):
		pyv8loader.load(pyv8_paths[1], delegate) 
	else:
		print('PyV8 auto-update is disabled')

	if settings.get('remove_html_completions', False):
		sublime.set_timeout(cmpl.remove_html_completions, 2000)

class SublimeLoaderDelegate(LoaderDelegate):
	def __init__(self, settings=None):

		if settings is None:
			settings = {}
			for k in ['http_proxy', 'https_proxy', 'timeout']:
				if user_settings.has(k):
					settings[k] = user_settings.get(k, None)

		LoaderDelegate.__init__(self, settings)
		self.state = None
		self.message = 'Loading PyV8 binary, please wait'
		self.i = 0
		self.addend = 1
		self.size = 8

	def on_start(self, *args, **kwargs):
		self.state = 'loading'

	def on_progress(self, *args, **kwargs):
		if kwargs['progress'].is_background:
			return

		before = self.i % self.size
		after = (self.size - 1) - before
		msg = '%s [%s=%s]' % (self.message, ' ' * before, ' ' * after)
		if not after:
			self.addend = -1
		if not before:
			self.addend = 1
		self.i += self.addend

		sublime.set_timeout(lambda: sublime.status_message(msg), 0)

	def on_complete(self, *args, **kwargs):
		self.state = 'complete'

		if kwargs['progress'].is_background:
			return

		sublime.set_timeout(lambda: sublime.status_message('PyV8 binary successfully loaded'), 0)

	def on_error(self, exit_code=-1, thread=None):
		self.state = 'error'
		sublime.set_timeout(lambda: show_pyv8_error(exit_code), 0)

	def setting(self, name, default=None):
		"Returns specified setting name"
		return self.settings.get(name, default)

	def log(self, message):
		print('Emmet: %s' % message)

def show_pyv8_error(exit_code):
	if 'PyV8' not in sys.modules:
		sublime.error_message('Error while loading PyV8 binary: exit code %s \nTry to manually install PyV8 from\nhttps://github.com/emmetio/pyv8-binaries' % exit_code)

def active_view():
	return sublime.active_window().active_view()

def check_context(verbose=False):
	"Checks if JS context is completely available"
	if not ctx.js():
		if verbose:
			sublime.message_dialog('Please wait a bit while PyV8 binary is being downloaded')
		return False

	return True


def replace_substring(start, end, value, no_indent=False):
	view = active_view()

	view.sel().clear()
	view.sel().add(sublime.Region(start, end or start)) 

	if not is_python3:
		value = value.decode('utf-8')

	# XXX a bit naive indentation control. It handles most common
	# `no_indent` usages like replacing CSS rule content, but may not
	# produce expected result in all possible situations

	if no_indent:
		line = view.substr(view.line(view.sel()[0]))
		value = unindent_text(value, get_line_padding(line))

	view.run_command('insert_snippet', {'contents': value})

def unindent_text(text, pad):
	"""
	Removes padding at the beginning of each text's line
	@type text: str
	@type pad: str
	"""
	lines = text.splitlines()
	
	for i,line in enumerate(lines):
		if line.startswith(pad):
			lines[i] = line[len(pad):]
	
	return '\n'.join(lines)

def get_line_padding(line):
	"""
	Returns padding of current editor's line
	@return str
	"""
	m = re.match(r'^(\s+)', line)
	return m and m.group(0) or ''

def update_settings():
	ctx.set_ext_path(settings.get('extensions_path', None))

	keys = ['snippets', 'preferences', 'syntaxProfiles', 'profiles']
	payload = {}
	for k in keys:
		data = settings.get(k, None)
		if data:
			payload[k] = data

	ctx.reset()
	ctx.load_user_data(json.dumps(payload))
	ctx.js()

def get_scope(view, pt=-1):
	if pt == -1:
		# use current caret position
		pt = view.sel()[0].begin()

	if hasattr(view, 'scope_name'):
		return view.scope_name(pt)

	return view.syntax_name(pt)

def should_perform_action(name, view=None):
	if not view:
		view = active_view()

	# fallback to old check
	if not view.settings().get('enable_emmet_keymap', True):
		return False

	disabled_actions = settings.get('disabled_keymap_actions', '')

	if not disabled_actions: # no disabled actions
		return True

	if disabled_actions == 'all': # disable all actions
		return False

	return name not in re.split(r'\s*,\s*', disabled_actions.strip())

def should_handle_tab_key(syntax=None):
	view = active_view()
	scopes = settings.get('disabled_single_snippet_for_scopes', None)
	cur_scope = get_scope(view)

	if sublime.score_selector(cur_scope, 'source.css'):
		return True

	if not scopes or not sublime.score_selector(cur_scope, scopes):
		return True

	with ctx.js() as c:
		abbr = c.locals.pyExtractAbbreviation()

		disabled_snippets = settings.get('disabled_single_snippets', '').split()
		if disabled_snippets and abbr in disabled_snippets:
			return False

		if not re.match(r'^[\w\-\:%]+$', abbr):
			# it's a complex expression
			return True

		if re.match(r'^(lorem|lipsum)([a-z]{2})?\d*$', abbr, re.I):
			# hardcoded Lorem Ipsum generator
			return True

		# detect inline CSS
		if syntax is None:
			syntax = c.locals.pyGetSyntax();

		if syntax == 'css':
			return True

		known_tags = settings.get('known_html_tags', '').split()
		if abbr in known_tags or c.locals.pyHasSnippet(abbr):
			return True

	return False

def log(message):
	if settings.get('debug', False):
		print('Emmet: %s' % message)

def action_factory(name):
	def _action(i, sel):
			with ctx.js() as c:
				return c.locals.pyRunAction(name)
	return _action

class RunEmmetAction(sublime_plugin.TextCommand):
	def run(self, edit, action=None, **kw):
		run_action(action_factory(action))

class ActionContextHandler(sublime_plugin.EventListener):
	def on_query_context(self, view, key, op, operand, match_all):
		if not key.startswith('emmet_action_enabled.'):
			return None

		prefix, name = key.split('.')
		return should_perform_action(name, view)

def get_edit(view, edit_token=None):
	edit = None
	try:
		edit = view.begin_edit()
	except:
		pass

	if not edit and edit_token:
		try:
			edit = view.begin_edit(edit_token, 'Emmet')
		except Exception as e:
			pass

	return edit

def run_action(action, view=None):
	if not check_context(True):
		return

	"Runs Emmet action in multiselection mode"
	if not view:
		view = active_view()

	region_key = '__emmet__'
	sels = list(view.sel())
	result = False

	# edit = get_edit(view, edit_token)
	max_sel_ix = len(sels) - 1

	try:
		for i, sel in enumerate(reversed(sels)):
			view.sel().clear()
			view.sel().add(sel)
			# run action
			# result = r(name) or result
			result = action(max_sel_ix - i, sel) or result

			# remember resulting selections
			view.add_regions(region_key,
					(view.get_regions(region_key) + list(view.sel())) , '')
	except Exception as e:
		view.erase_regions(region_key)
		print(traceback.format_exc())
		return
	

	# output all saved regions as selection
	view.sel().clear()
	for sel in view.get_regions(region_key):
		view.sel().add(sel)

	view.erase_regions(region_key)

	# if edit:
		# view.end_edit(edit)
	return result

class TabAndCompletionsHandler():
	def correct_syntax(self, view, syntax='html'):
		return syntax == 'html' and view.match_selector( view.sel()[0].b, cmpl.EMMET_SCOPE )

	def completion_handler(self, view):
		"Returns completions handler fo current caret position"
		black_list = settings.get('completions_blacklist', [])

		# A mapping of scopes, sub scopes and handlers, first matching of which
		# is used.
		COMPLETIONS = (
			(cmpl.HTML_INSIDE_TAG, self.html_elements_attributes),
			(cmpl.HTML_INSIDE_TAG_ATTRIBUTE, self.html_attributes_values)
		)

		pos = view.sel()[0].b

		# Try to find some more specific contextual abbreviation
		for sub_selector, handler in COMPLETIONS:
			h_name = handler.__name__
			if not black_list or h_name in black_list: continue
			if (view.match_selector(pos,  sub_selector) or
				 view.match_selector(pos - 1,  sub_selector)):
				return handler

		return None

	def html_elements_attributes(self, view, prefix, pos):
		tag         = cmpl.find_tag_name(view, pos)
		values      = HTML_ELEMENTS_ATTRIBUTES.get(tag, [])
		return [(v,   '%s\t@%s' % (v,v), '%s="$1"' % v) for v in values]

	def html_attributes_values(self, view, prefix, pos):
		attr        = cmpl.find_attribute_name(view, pos)
		values      = HTML_ATTRIBUTES_VALUES.get(attr, [])
		return [(v, '%s\t@=%s' % (v,v), v) for v in values]

	def expand_by_tab(self, view):
		if not check_context():
			return False;
			
		with ctx.js() as c:
			syntax = str(c.locals.pyGetSyntax());
		
		if not should_handle_tab_key(syntax):
			return False

		# we need to filter out attribute completions if 
		# 'disable_completions' option is not active
		if (not settings.get('disable_completions', False) and 
			self.correct_syntax(view, syntax) and 
			self.completion_handler(view)):
				return None

		caret_pos = view.sel()[0].begin()
		cur_scope = get_scope(view)

		# let's see if Tab key expander should be disabled for current scope
		banned_scopes = settings.get('disable_tab_abbreviations_for_scopes', '')
		if banned_scopes and view.score_selector(caret_pos, banned_scopes):
			return None

		# Sometimes ST2 matcher may incorrectly filter scope context,
		# check it against special regexp
		banned_regexp = settings.get('disable_tab_abbreviations_for_regexp', None)
		if banned_regexp and re.search(banned_regexp, cur_scope):
			return None
		
		return run_action(action_factory('expand_abbreviation'))
		# view.run_command('run_emmet_action',
		# 						{'action':'expand_abbreviation'})

class ExpandAbbreviationByTab(sublime_plugin.TextCommand):
	def run(self, edit, **kw):
		if settings.get('use_old_tab_handler', False):
			return
			
		view = active_view()
		h = TabAndCompletionsHandler()
		if not h.expand_by_tab(view):
			# try to mimic default Tab behaviour of Sublime Text
			view.run_command('insert_best_completion', {
				'default': '\t',
				'exact': user_settings.get('tab_completion', True)
			})


class TabExpandHandler(sublime_plugin.EventListener):
	def on_query_context(self, view, key, op, operand, match_all):
		if key != 'is_abbreviation':
			return None

		if settings.get('use_old_tab_handler', False):
			h = TabAndCompletionsHandler()
			return h.expand_by_tab(view)

		return check_context()

	def on_query_completions(self, view, prefix, locations):
		h = TabAndCompletionsHandler()
		if view.match_selector(locations[0], settings.get('css_completions_scope', '')) and check_context():
			l = []
			if settings.get('show_css_completions', False):
				with ctx.js() as c:
					completions = c.locals.pyGetCSSCompletions()
					if completions:
						for p in completions:
							l.append(('%s\t%s' % (p['k'], p['label']), p['v']))

			if not l:
				return []

			return (l, sublime.INHIBIT_WORD_COMPLETIONS | sublime.INHIBIT_EXPLICIT_COMPLETIONS)

		if not h.correct_syntax(view) or settings.get('disable_completions', False):
			return []

		handler = h.completion_handler(view)
		if handler:
			pos = view.sel()[0].b
			completions = handler(view, prefix, pos)
			return completions

		return []
		

class CommandsAsYouTypeBase(sublime_plugin.TextCommand):
	input_message         = "Enter Input"
	default_input         = ""
	process_panel_input   = lambda s, i: i.title()

	# Note that this must be of form `Packages/$Package/Emmet.tmLanguage` on ST3
	# NOT an absolute path!
	panel_grammar         = EMMET_GRAMMAR

	def is_enabled(self):
		return True

	def run_command(self, edit, view, processed_input):
		if '\n' in processed_input:
			for sel in view.sel():
				trailing = sublime.Region(sel.end(), view.line(sel).end())
				if view.substr(trailing).isspace():
					view.erase(edit, trailing)

		if not is_python3:
			processed_input = processed_input.decode('utf-8')
		view.run_command('insert_snippet', { 'contents': processed_input })

	def on_panel_change(self, abbr):
		if not abbr and self.erase:
			self.undo()
			self.erase = False
			return

		def inner_insert():
			self.view.run_command(self.name(), dict(panel_input=abbr))
			# self.view.run_command('hide_auto_complete')

		self.undo()
		sublime.set_timeout(inner_insert, 0)

	def undo(self):
		if self.erase:
			sublime.set_timeout(lambda: self.view.run_command('undo'), 0)

	def remember_sels(self, view):
		self._sels = list(view.sel())
		self._sel_items = []

		for sel in self._sels:
			# selection should be unindented in order to get desired result
			line = view.substr(view.line(sel))
			s = view.substr(sel)
			self._sel_items.append(unindent_text(s, get_line_padding(line)))

	def on_panel_done(self, abbr):
		if abbr:
			self.default_input = abbr

	def run(self, edit, panel_input=None, **kwargs):

		if panel_input is None:
			self.setup(edit, self.view, **kwargs)
			self.erase = False

			panel = self.view.window().show_input_panel (
				self.input_message,
				self.default_input,
				self.on_panel_done,              # on_done
				self.on_panel_change,            # on_change
				self.undo)                       # on_cancel

			panel.sel().clear()
			panel.sel().add(sublime.Region(0, panel.size()))

			if self.panel_grammar:
				panel.set_syntax_file(self.panel_grammar)
				panel_setting = panel.settings().set

				panel_setting('line_numbers',   False)
				panel_setting('gutter',         False)
				panel_setting('auto_complete',  False)
				panel_setting('tab_completion', False)
		else:
			self.run_on_input(edit, self.view, panel_input)

	def setup(self, edit, view, **kwargs):
		pass

	def run_on_input(self, edit, view, panel_input):
		view = self.view
		cmd_input = self.process_panel_input(panel_input) or ''
		try:
			self.erase = self.run_command(edit, view, cmd_input) is not False
		except:
			pass

class WrapAsYouType(CommandsAsYouTypeBase):
	default_input = 'div'
	_prev_output = ''
	input_message = 'Enter Wrap Abbreviation: '

	def setup(self, edit, view, **kwargs):
		self._prev_output = ''

		with ctx.js() as c: 
			r = c.locals.pyResetCache()
			if len(view.sel()) == 1:
				# capture wrapping context (parent HTML element) 
				# if there is only one selection
				r = c.locals.pyCaptureWrappingRange()
				if r:
					view.sel().clear()
					view.sel().add(sublime.Region(r[0], r[1]))
					view.show(view.sel())

		self.remember_sels(view)

	# override method to correctly wrap abbreviations
	def run_on_input(self, edit, view, abbr):
		self.erase = True

		# restore selections
		view.sel().clear()
		for sel in self._sels:
			view.sel().add(sel)

		def ins(i, sel):
			try:
				with ctx.js() as c:
					opt = {
						'selectedContent': self._sel_items[i],
						'index': i,
						'selectedRange': sel
					}
					self._prev_output = c.locals.pyExpandAsYouType(abbr, opt)
				# self.run_command(view, output)
			except Exception as e:
				"dont litter the console"

			self.run_command(edit, view, self._prev_output)

		run_action(ins, view)

class ExpandAsYouType(WrapAsYouType):
	default_input = 'div'
	input_message = 'Enter Abbreviation: '

	def setup(self, edit, view, **kwargs):
		# adjust selection to non-space bounds
		sels = []
		for s in view.sel():
			text = view.substr(s)
			a = s.a + len(text) - len(text.lstrip())
			b = s.b - len(text) + len(text.rstrip())

			sels.append(sublime.Region(a, b))

		view.sel().clear()
		for s in sels:
			view.sel().add(s)
			
		self.remember_sels(active_view())

		with ctx.js() as c: 
			r = c.locals.pyResetCache()

class UpdateAsYouType(WrapAsYouType):
	default_input = ''
	input_message = 'Enter Abbreviation: '
	_prev_ranges = None
	_first_run = False

	def setup(self, edit, view, **kwargs):
		self._first_run = not self.default_input
		self._prev_ranges = None

		with ctx.js() as c: 
			r = c.locals.pyResetCache()

		self.remember_sels(view)

	def run_on_input(self, edit, view, abbr):
		self.erase = not self._first_run
		self._first_run = False

		# restore selections
		view.sel().clear()
		for sel in self._sels:
			view.sel().add(sel)

		def ins(i, sel):
			try:
				with ctx.js() as c:
					opt = {
						'index': i,
						'selectedRange': sel
					}
					ranges = c.locals.pyUpdateAsYouType(abbr, opt)
					if ranges:
						out = []
						for r in ranges:
							# transform JS object to native one
							out.append({
								'start': r['start'],
								'end': r['end'],
								'content': r['content']
							})
						self._prev_ranges = out
				# self.run_command(view, output)
			except Exception as e:
				"dont litter the console"

			self.run_command(edit, view, self._prev_ranges)

		run_action(ins, view)

	def run_command(self, edit, view, ranges):
		if not ranges:
			return

		for r in ranges:
			content = r['content']
			region = sublime.Region(r['start'], r['end'])
			view.replace(edit, region, content)

class EnterKeyHandler(sublime_plugin.EventListener):
	def on_query_context(self, view, key, op, operand, match_all):
		if key != 'clear_fields_on_enter_key':
			return None

		if settings.get('clear_fields_on_enter_key', False):
			view.run_command('clear_fields')

		return True


class RenameTag(sublime_plugin.TextCommand):
	def run(self, edit, **kw):
		if not check_context(True):
			return

		view = active_view()
		sels = list(view.sel())
		sel_cleared = False
		with ctx.js() as c:
			for s in sels:
				ranges = c.locals.pyGetTagNameRanges(s.begin())
				if ranges:
					if not sel_cleared:
						view.sel().clear()
						sel_cleared = True
						
					for r in ranges:
						view.sel().add(sublime.Region(r[0], r[1]))
					view.show(view.sel())

class EmmetInsertAttribute(sublime_plugin.TextCommand):
	def run(self, edit, attribute=None, **kw):
		if not attribute:
			return

		view = active_view()
		prefix = ''
		if view.sel():
			sel = view.sel()[0]
			if not view.substr(sublime.Region(sel.begin() - 1, sel.begin())).isspace():
				prefix = ' '

		view.run_command('insert_snippet', {'contents': '%s%s="$1"' % (prefix, attribute)})

class EmmetResetContext(sublime_plugin.TextCommand):
	def run(self, edit, **kw):
		update_settings()

def plugin_loaded():
	sublime.set_timeout(init, 200)

##################
# Init plugin
if not is_python3:
	init()

