import sublime
import sublime_plugin
import zencoding.bootstrap


def replace_substring(start, end, value):
    view = sublime.active_window().active_view()
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
