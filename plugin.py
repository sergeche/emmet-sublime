import sublime
import sublime_plugin
import zencoding.bootstrap

def active_view():
	return sublime.active_window().active_view()

def replace_substring(start, end, value):
    view = active_view()
    edit = view.begin_edit()

    view.sel().clear()
    view.sel().add(sublime.Region(start, end or start))
    view.run_command('insert_snippet', {'contents': value})
    view.end_edit(edit)

# create JS environment
JSCTX = zencoding.bootstrap.create_env(['../editor.js'])

# provide some contributions to JS
JSCTX.locals.sublime = sublime
JSCTX.locals.sublimeReplaceSubstring = replace_substring

class RunAction(sublime_plugin.TextCommand):
	def run(self, edit, action=None, **kw):
		JSCTX.locals.pyRunAction(action)

class ExpandAbbreviationByTab(sublime_plugin.TextCommand):
	def run(self, edit, **kw):
		# this is just a stub, the actual abbreviation expansion
		# is done in TabExpandHandler.on_query_context
		pass

class TabExpandHandler(sublime_plugin.EventListener):
	def on_query_context(self, view, key, op, operand, match_all):
		return key == 'is_abbreviation' and JSCTX.locals.pyRunAction('expand_abbreviation')
		