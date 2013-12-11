var console = {
	log: function(msg) {
		log(msg);
	}
};

if (typeof _ == 'undefined') {
	_ = emmet.require('lodash');
}

/**
 * Simple function alias to run Emmet action.
 * <code>editorProxy</code> object should be defined
 * in concrete plugin implementation.
 */
function pyRunAction(name) {
	return emmet.run(name, editorProxy);
}

function pyLoadSystemSnippets(data) {
	emmet.loadSystemSnippets(data);
}

function pyLoadCIU(data) {
	emmet.loadCIU(data);
}

function pyLoadUserData(data) {
	emmet.loadUserData(data);
}

function pyLoadExtensions(fileList) {
	fileList = _.toArray(fileList);
	emmet.loadExtensions(fileList);
}

function pyResetUserData() {
	emmet.resetUserData();
}

emmet.require('plugin/file')({
	_parseParams: function(args) {
		var params = {
			path: args[0],
			size: -1
		};

		args = _.rest(args);
		params.callback = _.last(args);
		args = _.initial(args);
		if (args.length) {
			params.size = args[0];
		}

		return params;
	},

	read: function(path, size, callback) {
		var params = this._parseParams(arguments);

		try {
			pyFile.read(params.path, params.size, function(err, content) {
				if (err) {
					return params.callback(err, content);
				}

				content = _.map(content || [], function(b) {
					return String.fromCharCode(b);
				}).join('');
				params.callback(null, content);
			});
		} catch(e) {
			params.callback(e);
		}
	},

	readText: function() {
		var params = this._parseParams(arguments);
		try {
			pyFile.read_text(params.path, params.size, params.callback);	
		} catch(e) {
			params.callback(e);
		}
		
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
});