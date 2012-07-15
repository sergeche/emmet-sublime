/**
 * Simple function alias to run Zen Coding action.
 * <code>editorProxy</code> object should be defined
 * in concrete plugin implementation.
 */
function pyRunAction(name) {
	return zen_coding.require('actions').run(name, editorProxy);
}

zen_coding.define('file', function(require, _) {
	return {
		read: function(path) {
			return pyFile.read(path);
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