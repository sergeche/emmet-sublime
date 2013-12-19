# coding=utf-8
import sys
import os
import os.path
import codecs
import json
import gc
import imp
import re
from file import File

BASE_PATH = os.path.abspath(os.path.dirname(__file__))
is_python3 = sys.version_info[0] > 2

ctx_info = {
	'context': None,
	'callbacks': [],
	'reload_callbacks': []
}

# Module callbacks and global JS context sharing
def on_context_created(cb):
	if ctx_info['context']:
		cb(ctx_info['context'])
	else:
		ctx_info['callbacks'].append(cb)

def on_context_reload(cb):
	ctx_info['reload_callbacks'].append(cb)

def on_module_reload():
	for c in ctx_info['reload_callbacks']:
		c()

	ctx_info['reload_callbacks'] = ctx_info['callbacks'] = []

def remove_reload_callback(cb):
	if cb in ctx_info['reload_callbacks']:
		ctx_info['reload_callbacks'].remove()

def set_global_context(ctx):
	ctx_info['context'] = ctx
	for c in ctx_info['callbacks']:
		c(ctx)

	ctx_info['callbacks'] = []

################################################

core_files = ['emmet-app.js', 'python-wrapper.js']

def should_use_unicode():
	"""
	WinXP unable to eval JS in unicode object (while other OSes requires it)
	This function checks if we have to use unicode when reading files
	"""
	ctx = PyV8.JSContext()
	ctx.enter()
	use_unicode = True
	try:
		ctx.eval(u'(function(){return;})()')
	except:
		use_unicode = False

	ctx.leave()

	return use_unicode

def make_path(filename):
	return os.path.normpath(os.path.join(BASE_PATH, filename))

def js_log(message):
	print(message)

def js_file_reader(file_path, use_unicode=True):
	if use_unicode:
		f = codecs.open(file_path, 'r', 'utf-8')
	else:
		f = open(file_path, 'r')

	content = f.read()
	f.close()

	return content

def import_pyv8():
	# Importing non-existing modules is a bit tricky in Python:
	# if we simply call `import PyV8` and module doesn't exists,
	# Python will cache this failed import and will always
	# throw exception even if this module appear in PYTHONPATH.
	# To prevent this, we have to manually test if 
	# PyV8.py(c) exists in PYTHONPATH before importing PyV8
	if 'PyV8' in sys.modules:
		# PyV8 was loaded by ST2, create global alias
		if 'PyV8' not in globals():
			globals()['PyV8'] = __import__('PyV8')
			
		return

	loaded = False
	f, pathname, description = imp.find_module('PyV8')
	bin_f, bin_pathname, bin_description = imp.find_module('_PyV8')
	if f:
		try:
			imp.acquire_lock()
			globals()['_PyV8'] = imp.load_module('_PyV8', bin_f, bin_pathname, bin_description)
			globals()['PyV8'] = imp.load_module('PyV8', f, pathname, description)
			imp.release_lock()
			loaded = True
		finally:
			# Since we may exit via an exception, close fp explicitly.
			if f:
				f.close()
			if bin_f:
				bin_f.close()

	if not loaded:
		raise ImportError('No PyV8 module found')
	
class Context():
	"""
	Creates Emmet JS core context.
	Before instantiating this class, make sure PyV8
	is available in `sys.path`
	
	@param files: Additional files to load with JS core
	@param path: Path to Emmet extensions
	@param contrib: Python objects to contribute to JS execution context
	@param pyv8_path: Location of PyV8 binaries
	"""
	def __init__(self, files=[], ext_path=None, contrib=None, logger=None, reader=js_file_reader):
		self.logger = logger
		self.reader = reader

		try:
			import_pyv8()
		except ImportError as e:
			pass

		self._ctx = None
		self._ctx_inited = False
		self._contrib = contrib
		self._should_load_extension = True

		# detect reader encoding
		self._use_unicode = None
		self._core_files = [] + core_files + files

		self._ext_path = None
		self.set_ext_path(ext_path)
		self._user_data = None

		set_global_context(self)

	def log(self, message):
		if self.logger:
			self.logger(message)
		
	def get_ext_path(self):
		return self._ext_path

	def set_ext_path(self, val):
		val = os.path.expanduser(val)
		val = os.path.abspath(val)

		if val == self._ext_path:
			return

		self._ext_path = val
		self.reset()

	def load_extensions(self, path=None):
		if path is None:
			path = self._ext_path;

		if path and os.path.isdir(path):
			ext_files = []
			self.log('Loading Emmet extensions from %s' % self._ext_path)
			for dirname, dirnames, filenames in os.walk(self._ext_path):
				for filename in filenames:
					if filename[0] != '.':
						ext_files.append(os.path.join(dirname, filename))

			self.js().locals.pyLoadExtensions(ext_files)

	def js(self):
		"Returns JS context"
		if not self._ctx:
			try:
				import_pyv8()
			except ImportError as e:
				return None 

			if 'PyV8' not in sys.modules:
				# Binary is not available yet
				return None

			if self._use_unicode is None:
				self._use_unicode = should_use_unicode()

			self._ctx_inited = False

			class JSContext(PyV8.JSContext):
				def __enter__(self):
					if not hasattr(self, '_counter'):
						self._counter = 0
					if not self._counter:
						self.lock = PyV8.JSLocker()
						self.lock.enter()
						self.enter()
						# print('Enter JS context')

					self._counter += 1
					return self

				def __exit__(self, exc_type, exc_value, traceback):
					self._counter -= 1
					if self._counter < 1 or exc_type is not None:
						# print('Exit JS context')
						self._counter = 0
						if self:
							self.leave()
						if self.lock:
							self.lock.leave()
							self.lock = None

			self._ctx = JSContext()
		
			for f in self._core_files:
				self.eval_js_file(f)

			with self._ctx as ctx:
				# load default snippets
				ctx.locals.pyLoadSystemSnippets(self.read_js_file(make_path('snippets.json')))
				ctx.locals.pyLoadCIU(self.read_js_file(make_path('caniuse.json')))

				# expose some methods
				ctx.locals.log = js_log
				ctx.locals.pyFile = File()

				if self._contrib:
					for k in self._contrib:
						ctx.locals[k] = self._contrib[k]

				self._ctx_inited = True
		
		# if not hasattr(PyV8.JSContext.current.locals, 'isEmmet'):
		# 	print('Enter Emmet context')
		# 	self._ctx.enter()

		if self._ctx_inited:
			with self._ctx as ctx:
				if self._should_load_extension:
					ctx.locals.pyResetUserData()
					self._should_load_extension = False
					self.load_extensions()

				if self._user_data:
					ctx.locals.pyLoadUserData(self._user_data)
					self._user_data = None

		return self._ctx

	def load_user_data(self, data):
		"Loads user data payload from JSON"
		self._user_data = data
		# self.js().locals.pyLoadUserData(data)

	def reset(self):
		"Resets JS execution context"
		if self._ctx:
			# self._ctx.leave()
			self._ctx = None
			try:
				PyV8.JSEngine.collect()
				gc.collect()
			except:
				pass

		self._should_load_extension = True

	def read_js_file(self, file_path, resolve_path=False):
		full_path = make_path(file_path) if resolve_path else file_path
		return self.reader(full_path, self._use_unicode)

	def eval(self, source):
		with self.js() as ctx:
			ctx.eval(source)

	def eval_js_file(self, file_path, resolve_path=True):
		with self.js() as ctx:
			ctx.eval(self.read_js_file(file_path, resolve_path), name=file_path, line=0, col=0)
