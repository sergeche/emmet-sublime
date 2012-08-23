var editorProxy = zen_coding.exec(function(require, _) {
	function activeView() {
		return sublime.active_window().active_view();
	}

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
			value = pyUpdateTabStops(value);
			sublimeReplaceSubstring(start, end, value, !!noIndent);
		},

		getContent: function() {
			var view = activeView();
			return view.substr(new sublime.Region(0, view.size()));
		},

		getSyntax: function() {
			var view = activeView();
			var scope = view.syntax_name(view.sel()[0].begin());
			var docType = 'html';

			if (~scope.indexOf('xsl')) {
				docType = 'xsl';
			} else if (/\b(html|js|less|scss|sass|css|xml|haml|stylus)\b/.test(scope)) {
				// Sublime has back to front scopes ....
				docType = RegExp.$1;
			}

			return docType;
		},

		getProfileName: function() {
			var view = activeView();

			var profile = view.settings()['zencoding.profile'] || null;
			if (profile)
				return profile;

			var pos = this.getCaretPos();

			if (view.match_selector(pos, 'text.xml'))
				return 'xml';

			if (view.match_selector(pos, 'text.html')) {
				if (~view.substr(new sublime.Region(0, 200)).toLowerCase().indexOf('xhtml')) {
					return 'xhtml';
				}
				return 'html';
			}
			
			return 'line';
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

function require(name) {
	return zen_coding.require(name);
}

function pyUpdateTabStops(value) {
	var base = 1000;
	var zeroBase = 0;
	return require('tabStops').processText(value, {
		tabstop: function(data) {
			var group = parseInt(data.group, 10);
			if (group === 0)
				group = ++zeroBase;
			else
				group += base;

			return '${' + group + (data.placeholder ? ':' + data.placeholder : '') + '}';
		}
	})
}

function pyExpandAbbreviationAsYouType(abbr) {
	var info = require('editorUtils').outputInfo(editorProxy);
	var result = zen_coding.expandAbbreviation(abbr, info.syntax, info.profile, 
					require('actionUtils').captureContext(editorProxy));
	return pyUpdateTabStops(result);
}

function pyWrapAsYouType(abbr, content) {
	var info = require('editorUtils').outputInfo(editorProxy);
	content = require('utils').escapeText(content);
	var result = require('wrapWithAbbreviation').wrap(abbr, content, info.syntax, info.profile);
	return pyUpdateTabStops(result);
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
