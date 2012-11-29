function activeView() {
	return sublime.active_window().active_view();
}

var editorProxy = emmet.exec(function(require, _) {
	return {
		getSelectionRange: function() {
			var view = activeView();
			var sel = view.sel()[0];
			return {
				start: sel.begin(),
				end: sel.end()
			};
		},

		createSelection: function(start, end) {
			var view = activeView();
			view.sel().clear();

			view.sel().add(new sublime.Region(start, end || start));
			view.show(view.sel());
		},

		getCurrentLineRange: function() {
			var view = activeView();
			var selection = view.sel()[0];
			var line = view.line(selection);
			return {
				start: line.begin(),
				end: line.end()
			};
		},

		getCaretPos: function() {
			var view = activeView();
			var sel = view.sel();
			return sel && sel[0] ? sel[0].begin() : 0;
		},

		setCaretPos: function(pos){
			this.createSelection(pos, pos);
		},

		getCurrentLine: function() {
			var view = activeView();
			return view.substr(view.line(view.sel()[0]));
		},

		replaceContent: function(value, start, end, noIndent) {
			if (_.isUndefined(end))
				end = _.isUndefined(start) ? this.getContent().length : start;
			if (_.isUndefined(start)) start = 0;

			// update tabstops: make sure all caret placeholder are unique
			// by default, abbreviation parser generates all unlinked (un-mirrored)
			// tabstops as ${0}, so we have upgrade all caret tabstops with unique
			// positions but make sure that all other tabstops are not linked accidentally
			value = pyPreprocessText(value);
			sublimeReplaceSubstring(start, end, value, !!noIndent);
		},

		getContent: function() {
			var view = activeView();
			return view.substr(new sublime.Region(0, view.size()));
		},

		getSyntax: function() {
			return pyGetSyntax();
		},

		getProfileName: function() {
			var view = activeView();
			var pos = this.getCaretPos();

			if (view.match_selector(pos, 'text.html') 
				&& sublimeGetOption('autodetect_xhtml', false)
				&& require('actionUtils').isXHTML(this)) {
				return 'xhtml';
			}

			if (view.match_selector(pos, 'string.quoted.double.block.python')
				|| view.match_selector(pos, 'source.coffee string')
				|| view.match_selector(pos, 'string.unquoted.heredoc')) {
				// use html's default profile for:
				// * Python's multiline block
				// * CoffeeScript string
				// * PHP heredoc
				return null;
			}

			if (view.score_selector(pos, 'source string')) {
				return 'line';
			}

			return null;
		},

		prompt: function(title) {
			return pyEditor.prompt();
		},

		getSelection: function() {
			var view = activeView();
			return view.sel() ? view.substr(view.sel()[0]) : '';
		},

		getFilePath: function() {
			return activeView().file_name();
		}
	};
});

var _completions = {};

function require(name) {
	return emmet.require(name);
}

function pyPreprocessText(value) {
	var base = 1000;
	var zeroBase = 0;
	var lastZero = null;
	var range = require('range');
	var ts = require('tabStops');

	var tabstopOptions = {
		tabstop: function(data) {
			var group = parseInt(data.group, 10);
			var isZero = group === 0;
			if (isZero)
				group = ++zeroBase;
			else
				group += base;

			var placeholder = data.placeholder;
			if (placeholder) {
				// recursively update nested tabstops
				placeholder = ts.processText(placeholder, tabstopOptions);
			}

			var result = '${' + group + (placeholder ? ':' + placeholder : '') + '}';

			if (isZero) {
				lastZero = range.create(data.start, result);
			}

			return result
		},
		escape: function(ch) {
			if (ch == '$') {
				return '\\$';
			}

			if (ch == '\\') {
				return '\\\\';
			}
 
			return ch;
		}
	};

	value = ts.processText(value, tabstopOptions);

	if (sublimeGetOption('insert_final_tabstop', false) && !/\$\{0\}$/.test(value)) {
		value += '${0}';
	} else if (lastZero) {
		value = require('utils').replaceSubstring(value, '${0}', lastZero);
	}
	
	return value;
}

function pyExpandAbbreviationAsYouType(abbr) {
	var info = require('editorUtils').outputInfo(editorProxy);
	var result = emmet.expandAbbreviation(abbr, info.syntax, info.profile, 
					require('actionUtils').captureContext(editorProxy));
	return pyPreprocessText(result);
}

function pyWrapAsYouType(abbr, content) {
	var info = require('editorUtils').outputInfo(editorProxy);
	content = require('utils').escapeText(content);
	var result = require('wrapWithAbbreviation').wrap(abbr, content, info.syntax, info.profile);
	return pyPreprocessText(result);
}

function pyCaptureWrappingRange() {
	var info = require('editorUtils').outputInfo(editorProxy);
	var range = editorProxy.getSelectionRange();
	var startOffset = range.start;
	var endOffset = range.end;
	
	if (startOffset == endOffset) {
		// no selection, find tag pair
		var matcher = require('html_matcher');
		range = matcher(info.content, startOffset, info.profile);
		
		if (!range || range[0] == -1) // nothing to wrap
			return null;
		
		/** @type Range */
		var utils = require('utils');
		var narrowedSel = utils.narrowToNonSpace(info.content, range[0], range[1] - range[0]);
		startOffset = narrowedSel.start;
		endOffset = narrowedSel.end;
	}

	return [startOffset, endOffset];
}

function pyGetTagNameRanges() {
	var ranges = [];
	var info = require('editorUtils').outputInfo(editorProxy);
		
	// search for tag
	try {
		var pair = require('html_matcher').getTags(info.content, editorProxy.getCaretPos(), info.profile);
		if (pair && pair[0]) {
			var openingTag = info.content.substring(pair[0].start, pair[0].end);
			var tagName = /^<([\w\-\:]+)/i.exec(openingTag)[1];
			ranges.push([pair[0].start + 1, pair[0].start + 1 + tagName.length]);

			if (pair[1]) {
				ranges.push([pair[1].start + 2, pair[1].start + 2 + tagName.length]);
			}
		}
	} catch (e) {}

	return ranges;
}

function pyGetTagRanges() {
	var ranges = [];
	var info = require('editorUtils').outputInfo(editorProxy);
		
	// search for tag
	try {
		var pair = require('html_matcher').getTags(info.content, editorProxy.getCaretPos(), info.profile);
		if (pair && pair[0]) {
			ranges.push([pair[0].start, pair[0].end]);
			if (pair[1]) {
				ranges.push([pair[1].start, pair[1].end]);
			}
		}
	} catch (e) {}

	return ranges;
}

function pyExtractAbbreviation() {
	return require('expandAbbreviation').findAbbreviation(editorProxy);
}

function pyHasSnippet(name) {
	return !!emmet.require('resources').findSnippet(editorProxy.getSyntax(), name);
}

/**
 * Get all available CSS completions. This method is optimized for CSS
 * only since it should contain snippets only so it's not required
 * to do extra parsing
 */
function pyGetCSSCompletions(dialect) {
	dialect = dialect || pyGetSyntax();

	if (!_completions[dialect]) {
		var all = require('resources').getAllSnippets(dialect);
		var css = require('cssResolver');
		_completions[dialect] = _.map(all, function(v, k) {
			var snippetValue = typeof v.parsedValue == 'object' 
				? v.parsedValue.data
				: v.value;
			var snippet = css.transformSnippet(snippetValue, false, dialect);
			return {
				k: v.nk,
				label: snippet.replace(/\:\s*\$\{0\}\s*;?$/, ''),
				v: snippet
			};
		});
	}

	return _completions[dialect];
}

/**
 * Returns current syntax name
 * @return {String}
 */
function pyGetSyntax() {
	var view = activeView();
	var scope = view.syntax_name(view.sel()[0].begin());

	if (~scope.indexOf('xsl')) {
		return 'xsl';
	}

	// detect CSS-like syntaxes independently, 
	// since it may cause collisions with some highlighters
	if (/\b(less|scss|sass|css|stylus)\b/.test(scope)) {
		return RegExp.$1;
	}

	if (/\b(html|xml|haml)\b/.test(scope)) {
		return RegExp.$1;
	}

	return 'html';
}