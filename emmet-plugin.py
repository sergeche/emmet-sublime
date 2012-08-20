import sublime
import sublime_plugin
from emmet.context import Context
import re
import json

__version__      = '1.0'
__core_version__ = '1.0'
__authors__      = ['"Sergey Chikuyonok" <serge.che@gmail.com>'
                    '"Nicholas Dudfield" <ndudfield@gmail.com>']

print("load")

def active_view():
	return sublime.active_window().active_view()

def replace_substring(start, end, value, no_indent=False):
	view = active_view()
	edit = view.begin_edit()

	view.sel().clear()
	view.sel().add(sublime.Region(start, end or start)) 

	# XXX a bit naive indentation control. It handles most common
	# `no_indent` usages like replacing CSS rule content, but may not
	# produce expected result in all possible situations
	if no_indent:
		line = view.substr(view.line(view.sel()[0]))
		value = unindent_text(value, get_line_padding(line))

	view.run_command('insert_snippet', {'contents': value.decode('utf-8')})
	view.end_edit(edit)

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

	print(payload)
	ctx.reset()
	ctx.load_user_data(json.dumps(payload))


# load settings
settings = sublime.load_settings('Emmet.sublime-settings')
settings.add_on_change('extensions_path', update_settings)

# provide some contributions to JS
contrib = {
	'sublime': sublime, 
	'sublimeReplaceSubstring': replace_substring
}

# create JS environment
ctx = Context(['../editor.js'], settings.get('extensions_path', None), contrib)

print(ctx)

update_settings()

class RunAction(sublime_plugin.TextCommand):
	def run(self, edit, action=None, **kw):
		ctx.js().locals.pyRunAction(action)


class ExpandAbbreviationByTab(sublime_plugin.TextCommand):
	def run(self, edit, **kw):
		# this is just a stub, the actual abbreviation expansion
		# is done in TabExpandHandler.on_query_context
		pass


class TabExpandHandler(sublime_plugin.EventListener):
	def on_query_context(self, view, key, op, operand, match_all):
		return key == 'is_abbreviation' and ctx.js().locals.pyRunAction('expand_abbreviation')
		

class CommandsAsYouTypeBase(sublime_plugin.TextCommand):
	history = {}
	filter_input = lambda s, i: i
	selection = ''

	def setup(self):
		pass

	def run_command(self, view, value):
		if '\n' in value:
			for sel in view.sel():
				trailing = sublime.Region(sel.end(), view.line(sel).end())
				if view.substr(trailing).isspace():
					view.erase(self.edit, trailing)

		view.run_command('insert_snippet', { 'contents': value.decode('utf-8') })

	def insert(self, abbr):
		view = self.view

		if not abbr and self.erase:
			self.undo()
			self.erase = False
			return

		def inner_insert():
			self.edit = edit = view.begin_edit()
			cmd_input  = self.filter_input(abbr) or ''
			try:
				self.erase = self.run_command(view, cmd_input) is not False
			except:
				pass
			view.end_edit(edit)

		self.undo()
		sublime.set_timeout(inner_insert, 0)

	def undo(self):
		if self.erase:
			sublime.set_timeout(lambda: self.view.run_command('undo'), 0)

	def run(self, edit, **args):
		self.setup()
		self.erase = False

		panel = self.view.window().show_input_panel (
			self.input_message, self.default_input, None, self.insert, self.undo )

		panel.sel().clear()
		panel.sel().add(sublime.Region(0, panel.size()))


class ExpandAsYouType(CommandsAsYouTypeBase):
	default_input = 'div'
	input_message = "Enter Abbreviation: "

	def filter_input(self, abbr):
		try:
			return ctx.js().locals.pyExpandAbbreviationAsYouType(abbr)
		except Exception:
			"dont litter the console"


class WrapAsYouType(CommandsAsYouTypeBase):
	default_input = 'div'
	input_message = "Enter Wrap Abbreviation: "

	def setup(self):
		# capture wrapping content
		r = ctx.js().locals.pyCaptureWrappingRange()
		if not r:
			return # nothing to wrap

		view = active_view()
		view.sel().clear()
		view.sel().add(sublime.Region(r[0], r[1]))
		view.show(view.sel())

		# selection should be unindented in order to get desired result
		line = view.substr(view.line(view.sel()[0]))
		s = view.substr(view.sel()[0])
		self.selection = unindent_text(s, get_line_padding(line))

	def filter_input(self, abbr):
		try:
			return ctx.js().locals.pyWrapAsYouType(abbr, self.selection)
		except Exception:
			"dont litter the console"

class HandleEnterKey(sublime_plugin.TextCommand):
	def run(self, edit, **kw):
		view = active_view()
		if settings.get('clear_fields_on_enter_key', False):
			view.run_command('clear_fields')

		# let's see if we have to insert formatted linebreak
		scope = view.syntax_name(view.sel()[0].begin())
		if sublime.score_selector(scope, 'meta.scope.between-tag-pair.html') > 0:
			view.run_command('insert_snippet', {'contents': '\n\t${0}\n'})
		else:
			view.run_command('insert_snippet', {'contents': '\n${0}'})

class RenameTag(sublime_plugin.TextCommand):
	def run(self, edit, **kw):
		ranges = ctx.js().locals.pyGetTagNameRanges()
		if ranges:
			view = active_view()
			view.sel().clear()
			for r in ranges:
				view.sel().add(sublime.Region(r[0], r[1]))
			view.show(view.sel())
