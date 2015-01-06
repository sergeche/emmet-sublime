var console = {
	log: function(msg) {
		log(msg);
	}
};

function _toArray(obj, ix) {
	// Some array-like objects coming from Python
	// cannot be converted with simple Array#slice call.
	ix = ix || 0;
	if ('length' in obj) {
		return Array.prototype.slice.call(obj, ix);
	}

	// Convert object manually
	var out = [];
	var keys = Object.keys(obj);
	for (var i = ix || 0, il = keys.length; i < il; i++) {
		out.push(obj[keys[i]]);
	}
	return out;
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
	emmet.loadExtensions(_toArray(fileList));
}

function pyResetUserData() {
	emmet.resetUserData();
}

emmet.file({
	_parseParams: function(args) {
		var params = {
			path: args[0],
			size: -1
		};

		args = _toArray(args, 1);
		params.callback = args.pop();
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

				content = _toArray(content || []).map(function(b) {
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