/**
 * Simple function alias to run Zen Coding action.
 * <code>editorProxy</code> object should be defined
 * in concrete plugin implementation.
 */
function pyRunAction(name) {
	return emmet.require('actions').run(name, editorProxy);
}

function pyLoadSystemSnippets(data) {
	emmet.require('bootstrap').loadSystemSnippets(data);
}

function pyLoadUserData(data) {
	emmet.require('bootstrap').loadUserData(data);
}

function pyLoadExtensions(fileList) {
	emmet.require('bootstrap').loadExtensions(fileList);
}

function pyResetUserData() {
	emmet.require('bootstrap').resetUserData();
}

emmet.define('file', function(require, _) {
	return {
		read: function(path) {
			return _.map(pyFile.read(path) || [], function(b) {
				return String.fromCharCode(b);
			}).join('');
		},

		locateFile: function(editorFile, fileName) {
			return pyFile.locate_file(editorFile, fileName);
		},

		createPath: function(parent, fileName) {
			return pyFile.create_path(parent, fileName);
		},

		save: function(file, content) {
			return pyFile.save(file, content);
		},

		getExt: function(file) {
			var m = (file || '').match(/\.([\w\-]+)$/);
			return m ? m[1].toLowerCase() : '';
		}
	};
});