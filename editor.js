var _completions = {};

// some caching data used during action sessions
// make sure to call pyResetCache() before each new function call
var __cache = {};

var editorUtils = emmet.utils.editor;
var actionUtils = emmet.utils.action;
var range = emmet.require('assets/range.js');
var tabStops = emmet.tabStops;
var utils = emmet.utils.common;
var htmlMatcher = emmet.htmlMatcher;
var resources = emmet.resources;
var cssResolver = emmet.require('resolver/css.js');
var abbreviationParser = emmet.require('parser/abbreviation.js');
var expandAbbreviationAction = emmet.require('action/expandAbbreviation.js');
var updateTagAction = emmet.require('action/updateTag.js');

function activeView() {
	return sublime.active_window().active_view();
}

var editorProxy = {
	getSelectionRange: function() {
		var view = activeView();
		var sel = view.sel()[0];
		return {
			start: jsIndex(sel.begin()),
			end: jsIndex(sel.end())
		};
	},

	createSelection: function(start, end) {
		var view = activeView();
		view.sel().clear();

		view.sel().add(new sublime.Region(pyIndex(start), pyIndex(end || start)));
		view.show(view.sel());
	},

	getCurrentLineRange: function() {
		var view = activeView();
		var selection = view.sel()[0];
		var line = view.line(selection);
		return {
			start: jsIndex(line.begin()),
			end: jsIndex(line.end())
		};
	},

	getCaretPos: function() {
		var view = activeView();
		var sel = view.sel();
		return jsIndex(sel && sel[0] ? sel[0].begin() : 0);
	},

	setCaretPos: function(pos){
		this.createSelection(pyIndex(pos), pyIndex(pos));
	},

	getCurrentLine: function() {
		var view = activeView();
		return view.substr(view.line(view.sel()[0]));
	},

	replaceContent: function(value, start, end, noIndent) {
		if (typeof end === 'undefined')
			end = typeof start === 'undefined' ? this.getContent().length : start;
		if (typeof start === 'undefined') start = 0;

		// update tabstops: make sure all caret placeholder are unique
		// by default, abbreviation parser generates all unlinked (un-mirrored)
		// tabstops as ${0}, so we have upgrade all caret tabstops with unique
		// positions but make sure that all other tabstops are not linked accidentally
		value = pyPreprocessText(value);
		value = editorUtils.normalize(value);
		sublimeReplaceSubstring(pyIndex(start), pyIndex(end), value, !!noIndent);
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

		var m = function(sel) {
			return view.match_selector(pyIndex(pos), sel);
		}

		if (m('text.html') && sublimeGetOption('autodetect_xhtml', false) && actionUtils.isXHTML(this)) {
			return 'xhtml';
		}

		if (m('string.quoted.double.block.python')
			|| m('source.coffee string')
			|| (m('source.php string') && !sublimeGetOption('php_single_line'))
			|| m('string.unquoted.heredoc')) {
			// use html's default profile for:
			// * Python's multiline block
			// * CoffeeScript string
			// * PHP heredoc
			return pyDetectProfile();
		}

		if (m('source string')) {
			return 'line';
		}

		return pyDetectProfile();
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

function pyPreprocessText(value) {
	var base = 1000;
	var zeroBase = 0;
	var lastZero = null;

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
				placeholder = tabStops.processText(placeholder, tabstopOptions);
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

	value = tabStops.processText(value, tabstopOptions);

	if (sublimeGetOption('insert_final_tabstop', false) && !/\$\{0\}$/.test(value)) {
		value += '${0}';
	} else if (lastZero) {
		value = utils.replaceSubstring(value, '${0}', lastZero);
	}
	
	return value;
}

function pyExpandAsYouType(abbr, options) {
	options = options || {};
	var ix = (options.index || 0);
	var cacheKey = 'expandParams' + ix;
	if (!(cacheKey in __cache)) {
		var capturePos = options.selectedRange 
			? options.selectedRange.begin() 
			: editorProxy.getCaretPos();

		__cache[cacheKey] = {
			syntax: editorProxy.getSyntax(), 
			profile: editorProxy.getProfileName() || null,
			counter: ix + 1,
			contextNode: actionUtils.captureContext(editorProxy, capturePos)
		};

		if (options.selectedContent) {
			__cache[cacheKey].pastedContent = utils.escapeText(options.selectedContent);
		}
	}

	try {
		var result = abbreviationParser.expand(abbr, __cache[cacheKey]);
		return pyPreprocessText(result);
	} catch(e) {
		return '';
	}
}

function pyUpdateAsYouType(abbr, options) {
	options = options || {};
	var ix = (options.index || 0);
	var cacheKey = 'updateParams' + ix;
	if (!(cacheKey in __cache)) {
		var capturePos = options.selectedRange 
			? options.selectedRange.begin() 
			: editorProxy.getCaretPos();

		__cache[cacheKey] = {
			counter: ix + 1,
			content: editorProxy.getContent(),
			ctx: actionUtils.captureContext(editorProxy, capturePos)
		};
	}

	// try {
		var cache = __cache[cacheKey];
		if (!cache.ctx) {
			return null;
		}

		var tag = updateTagAction.getUpdatedTag(abbr, cache.ctx, cache.content, {
			counter: cache.counter
		});

		if (!tag) {
			return null;
		}

		var out = [{
			start: cache.ctx.match.open.range.start, 
			end: cache.ctx.match.open.range.end,
			content: tag.source
		}];

		if (tag.name() != cache.ctx.name && cache.ctx.match.close) {
			out.unshift({
				start: cache.ctx.match.close.range.start, 
				end: cache.ctx.match.close.range.end,
				content: '</' + tag.name() + '>'
			});
		}

		return out;
	// } catch(e) {
	// 	console.log(e);
	// 	return null;
	// }
}

function pyCaptureWrappingRange() {
	var info = editorUtils.outputInfo(editorProxy);
	var range = editorProxy.getSelectionRange();
	var startOffset = range.start;
	var endOffset = range.end;
	
	if (startOffset == endOffset) {
		// no selection, find tag pair
		var match = htmlMatcher.find(info.content, startOffset);
		if (!match) {
			// nothing to wrap
			return null;
		}
		
		var narrowedSel = utils.narrowToNonSpace(info.content, match.range);
		startOffset = narrowedSel.start;
		endOffset = narrowedSel.end;
	}

	return [startOffset, endOffset];
}

function pyGetTagNameRanges(pos) {
	var ranges = [];
	var info = editorUtils.outputInfo(editorProxy);
		
	// search for tag
	try {
		var tag = htmlMatcher.tag(info.content, pos);
		if (tag) {
			var open = tag.open.range;
			var tagName = /^<([\w\-\:]+)/i.exec(open.substring(info.content))[1];
			ranges.push([open.start + 1, open.start + 1 + tagName.length]);

			if (tag.close) {
				ranges.push([tag.close.range.start + 2, tag.close.range.start + 2 + tagName.length]);
			}
		}
	} catch (e) {}

	return ranges;
}

function pyGetTagRanges() {
	var ranges = [];
	var info = editorUtils.outputInfo(editorProxy);
		
	// search for tag
	try {
		var tag = htmlMatcher.tag(info.content, editorProxy.getCaretPos());
		if (tag) {
			ranges.push(tag.open.range.toArray());
			if (tag.close) {
				ranges.push(tag.close.range.toArray());
			}
		}
	} catch (e) {}

	return ranges;
}

function pyExtractAbbreviation() {
	return expandAbbreviationAction.findAbbreviation(editorProxy);
}

function pyHasSnippet(name) {
	return !!resources.findSnippet(editorProxy.getSyntax(), name);
}

/**
 * Get all available CSS completions. This method is optimized for CSS
 * only since it should contain snippets only so it's not required
 * to do extra parsing
 */
function pyGetCSSCompletions(dialect) {
	dialect = dialect || pyGetSyntax();

	if (!_completions[dialect]) {
		var all = resources.getAllSnippets(dialect);
		_completions[dialect] = Object.keys(all).map(function(k) {
			var v = all[k];
			var snippetValue = typeof v.parsedValue == 'object' 
				? v.parsedValue.data
				: v.value;
			var snippet = cssResolver.transformSnippet(snippetValue, false, dialect);
			return {
				k: v.nk,
				label: snippet.replace(/\:\s*\$\{0\}\s*;?$/, ''),
				v: cssResolver.expandToSnippet(v.nk, dialect)
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
	var pt = view.sel()[0].begin();
	var scope = 'scope_name' in view ? view.scope_name(pt) : view.syntax_name(pt);

	if (~scope.indexOf('xsl')) {
		return 'xsl';
	}

	if (!/\bstring\b/.test(scope) && /\bsource\.jsx?\b/.test(scope)) {
		return 'jsx';
	}

	var syntax = 'html';

	if (!/\bstring\b/.test(scope) && /\bsource\.([\w\-]+)/.test(scope) && resources.hasSyntax(RegExp.$1)) {
		syntax = RegExp.$1;
	} else if (/\b(less|scss|sass|css|stylus|postcss)\b/.test(scope)) {
		// detect CSS-like syntaxes independently,
		// since it may cause collisions with some highlighters
		syntax = RegExp.$1;

		if (syntax === 'postcss') {
			syntax = 'css';
		}
	} else if (/\b(html|xml|haml|slim|jade|pug)\b/.test(scope)) {
		syntax = RegExp.$1;
	}

	return actionUtils.detectSyntax(editorProxy, syntax);
}

function pyDetectProfile(syntax) {
	return actionUtils.detectProfile(editorProxy, syntax);
}

function pyResetCache() {
	__cache = {};
}

/* Translates an index from the JS string of the active view to the equivalent
 * index in sublime by accounting for UTF-16 surrogate pairs.
 */
function pyIndex(index) {
	var surr = supplementary(activeView());
	for(var i = 0; i < surr.length; ++i) {
		if(surr[i] >= index) break;
		--index;
	}
	return index;
}

/* Translates a character index from the active view into the equivalent JS
 * string index by accounting for Supplementary Plane characters.
 */
function jsIndex(index) {
	var surr = supplementary(activeView());
	for(var i = 0; i < surr.length; ++i) {
		if(surr[i] >= index) break;
	}
	return index + i;
}

var __supplementaryCache = {};

function supplementary(view) {
	if(sublime.version()[0] == "2") return [];
	var s = __supplementaryCache[view.id()];
	if(s === undefined || s.change_count != view.change_count()) {
		__supplementaryCache[view.id()] = s = {
			change_count: view.change_count(),
			indices: []
		};
		var found = view.find_all("[𐀀-􏿿]");
		for(var i = 0; found[i] !== undefined; ++i)
			s.indices.push(found[i].a);
	}
	return s.indices;
}

