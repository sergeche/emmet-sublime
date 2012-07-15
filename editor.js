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
			return view.sel().length ? view.sel()[0].begin() : 0;
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
			var base = 1000;
			var zeroBase = 0;
			value = require('tabStops').processText(value, {
				tabstop: function(data) {
					var group = parseInt(data.group, 10);
					if (group === 0)
						group = ++zeroBase;
					else
						group += base;

					return '${' + group + (data.placeholder ? ':' + data.placeholder : '') + '}';
				}
			});

			sublimeReplaceSubstring(start, end, value);
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
			
			return 'plain';
		},

		prompt: function(title) {
			return pyEditor.prompt();
		},

		getSelection: function() {
			var view = activeView();
			return view.sel() ? view.sel()[0] : '';
		},

		getFilePath: function() {
			return activeView().file_name();
		}
	};
});