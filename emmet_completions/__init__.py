import sys
import sublime
import sublime_plugin

from trackers import back_track, track_regex, track_scope

__authors__     = ['"Sergey Chikuyonok" <serge.che@gmail.com>'
				   '"Nicholas Dudfield" <ndudfield@gmail.com>']

HTML                      = 'text.html - source'
XML                       = 'text.xml'

HTML_INSIDE_TAG_ANYWHERE  = 'text.html meta.tag'
HTML_INSIDE_TAG           = ( 'text.html meta.tag - string - '
							  'meta.scope.between-tag-pair.html '
							  '-punctuation.definition.tag.begin.html')

HTML_INSIDE_TAG_ATTRIBUTE = 'text.html meta.tag string'

HTML_NOT_INSIDE_TAG       = 'text.html - meta.tag'

NO_PLUG = sublime.INHIBIT_EXPLICIT_COMPLETIONS
NO_BUF  = sublime.INHIBIT_WORD_COMPLETIONS

EMMET_SCOPE = ', '.join([HTML, XML])

def find_tag_start(view, start_pt):
	regions = back_track(view, start_pt, track_regex('<', False) )
	return regions[-1].begin()

def find_tag_name(view, start_pt):
	tag_region = view.find('[a-zA-Z:]+', find_tag_start(view, start_pt))
	name       = view.substr( tag_region )
	return name

def find_attribute_name(view, start_pt):
	conds   = track_scope('string'), track_regex('\s|='), track_regex('\S')
	regions = back_track(view, start_pt, *conds)
	return view.substr(regions[-1])

def remove_html_completions():
    for completer in "TagCompletions", "HtmlCompletions":
        try:
            import html_completions
            cm = getattr(html_completions, completer)
        except (ImportError, AttributeError):
            continue

        completions = sublime_plugin.all_callbacks['on_query_completions']
        for i, instance in enumerate (completions):
            if isinstance(instance, cm):
                del completions[i]
