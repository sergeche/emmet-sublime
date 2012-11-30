# coding=utf-8
import sys
import os
import os.path
import platform
import codecs
import json
import gc
import pyv8loader
import zipfile
import threading
import imp
import time
import re
import semver
from file import File

BASE_PATH = os.path.abspath(os.path.dirname(__file__))
CHECK_INTERVAL = 60 * 60 * 24
# CHECK_INTERVAL = 1
core_files = ['emmet-app.js', 'python-wrapper.js']

def get_arch():
	"Returns architecture name for PyV8 binary"
	is_64bit = sys.maxsize > 2**32
	system_name = platform.system()
	if system_name == 'Darwin':
		if semver.match(platform.mac_ver()[0], '<10.7.0'):
			return 'mac106'

		return 'osx'
	if system_name == 'Windows':
		return 'win64' if is_64bit else 'win32'
	if system_name == 'Linux':
		return 'linux64' if is_64bit else 'linux32'

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

def unpack_pyv8(package_dir):
	f = os.path.join(package_dir, 'pack.zip')
	if not os.path.exists(f):
		return

	package_zip = zipfile.ZipFile(f, 'r')

	root_level_paths = []
	last_path = None
	for path in package_zip.namelist():
		last_path = path
		if path.find('/') in [len(path) - 1, -1]:
			root_level_paths.append(path)
		if path[0] == '/' or path.find('../') != -1 or path.find('..\\') != -1:
			raise 'The PyV8 package contains files outside of the package dir and cannot be safely installed.'

	if last_path and len(root_level_paths) == 0:
		root_level_paths.append(last_path[0:last_path.find('/') + 1])

	prev_dir = os.getcwd()
	os.chdir(package_dir)

	# Here we don't use .extractall() since it was having issues on OS X
	skip_root_dir = len(root_level_paths) == 1 and \
		root_level_paths[0].endswith('/')
	extracted_paths = []
	for path in package_zip.namelist():
		dest = path
		try:
			if not isinstance(dest, unicode):
				dest = unicode(dest, 'utf-8', 'strict')
		except (UnicodeDecodeError):
			dest = unicode(dest, 'cp1252', 'replace')

		if os.name == 'nt':
			regex = ':|\*|\?|"|<|>|\|'
			if re.search(regex, dest) != None:
				print ('%s: Skipping file from package named %s due to ' +
					'an invalid filename') % (__name__, path)
				continue

		# If there was only a single directory in the package, we remove
		# that folder name from the paths as we extract entries
		if skip_root_dir:
			dest = dest[len(root_level_paths[0]):]

		if os.name == 'nt':
			dest = dest.replace('/', '\\')
		else:
			dest = dest.replace('\\', '/')

		dest = os.path.join(package_dir, dest)

		def add_extracted_dirs(dir):
			while dir not in extracted_paths:
				extracted_paths.append(dir)
				dir = os.path.dirname(dir)
				if dir == package_dir:
					break

		if path.endswith('/'):
			if not os.path.exists(dest):
				os.makedirs(dest)
			add_extracted_dirs(dest)
		else:
			dest_dir = os.path.dirname(dest)
			if not os.path.exists(dest_dir):
				os.makedirs(dest_dir)
			add_extracted_dirs(dest_dir)
			extracted_paths.append(dest)
			try:
				open(dest, 'wb').write(package_zip.read(path))
			except (IOError, UnicodeDecodeError):
				print ('%s: Skipping file from package named %s due to ' +
					'an invalid filename') % (__name__, path)
	package_zip.close()

	os.chdir(prev_dir)
	os.remove(f)

def import_pyv8():
	# Importing non-existing modules is a bit tricky in Python:
	# if we simply call `import PyV8` and module doesn't exists,
	# Python will cache this failed import and will always
	# throw exception even if this module appear in PYTHONPATH.
	# To prevent this, we have to manually test if 
	# PyV8.py(c) exists in PYTHONPATH before importing PyV8
	if 'PyV8' in sys.modules and 'PyV8' not in globals():
		# PyV8 was loaded by ST2, create global alias
		globals()['PyV8'] = __import__('PyV8')
		return

	f, pathname, description = imp.find_module('PyV8')
	bin_f, bin_pathname, bin_description = imp.find_module('_PyV8')
	loaded = False
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

def get_loader_config(path):
	config = {
		"last_id": 0,
		"last_update": 0,
		"skip_update": False
	}

	config_path = os.path.join(path, 'config.json')
	if os.path.exists(config_path):
		with open(config_path) as fd:
			for k,v in json.load(fd).items():
				config[k] = v

	return config

def save_loader_config(path, data):
	config_path = os.path.join(path, 'config.json')
	
	if not os.path.exists(path):
		os.makedirs(path)
	fp = open(config_path, 'w')
	fp.write(json.dumps(data))
	fp.close()
	

class Context():
	"""
	Creates Emmet JS core context
	@param files: Additional files to load with JS core
	@param path: Path to Emmet extensions
	@param contrib: Python objects to contribute to JS execution context
	@param pyv8_path: Location of PyV8 binaries
	"""
	def __init__(self, files=[], path=None, contrib=None, pyv8_path='./PyV8', delegate=None):
		self._ctx = None
		self._contrib = contrib
		self._should_load_extension = True
		self.pyv8_path = os.path.abspath(os.path.join(pyv8_path, get_arch()))
		self.pyv8_state = 'none'
		self.delegate = delegate if delegate  else pyv8loader.LoaderDelegate()

		# pre-flight check: if there’s unpacked binary, 
		# extract contents from archive and remove it
		if self.pyv8_path not in sys.path:
			sys.path.append(os.path.abspath(pyv8_path))
			sys.path.append(self.pyv8_path)
			
		unpack_pyv8(self.pyv8_path)
		self._load_pyv8()

		# detect reader encoding
		self._use_unicode = None
		self._core_files = [] + core_files + files

		self._ext_path = None
		self.set_ext_path(path)
		self._user_data = None

		
	def get_ext_path(self):
		return self._ext_path

	def set_ext_path(self, val):
		try:
			if val and val[:1] == '~':
				val = os.path.expanduser(val)

			val = os.path.abspath(val)
		except Exception, e:
			return

		if val == self._ext_path:
			return

		self._ext_path = val
		self.reset()

	def load_extensions(self, path=None):
		if path is None:
			path = self._ext_path;

		if path and os.path.isdir(path):
			ext_files = []
			print('Loading Emmet extensions from %s' % self._ext_path)
			for dirname, dirnames, filenames in os.walk(self._ext_path):
				for filename in filenames:
					ext_files.append(os.path.join(dirname, filename))

			self.js().locals.pyLoadExtensions(ext_files)

	def _call_delegate(self, name, *args, **kwargs):
		if self.delegate and hasattr(self.delegate, name) and callable(getattr(self.delegate, name)):
			getattr(self.delegate, name)(*args, **kwargs)

	def _load_pyv8(self):
		"Attempts to load PyV8 module"
		try:
			import_pyv8()
		except ImportError, e:
			# Module not found, pass-through this error
			# since we are going to try to download most recent version
			# anyway
			pass

		config = get_loader_config(self.pyv8_path)

		if 'PyV8' in sys.modules and (config['skip_update'] or time.time() < config['last_update'] + CHECK_INTERVAL):
			# No need to load anything: user already has PyV8 binary
			# or decided to disable update process
			print('PyV8: No need to update')
			return

		def on_complete(result, thread):
			if result is not None:
				# Most recent version was downloaded
				config['last_id'] = result				
				if 'PyV8' not in sys.modules:
					# PyV8 is not loaded, we can safely unpack it and load
					unpack_pyv8(self.pyv8_path)
					# Do not load PyV8 here since this code is called
					# from another thread
					# import_pyv8()

			config['last_update'] = time.time()
			save_loader_config(self.pyv8_path, config)
			self.pyv8_state = 'loaded'

		def on_error(*args, **kwargs):
			self.pyv8_state = 'error'

		# try to download most recent version of PyV8
		thread = pyv8loader.PyV8Loader(get_arch(), self.pyv8_path, config)
		thread.start()
		self.pyv8_state = 'loading'
		
		# watch on download progress
		prog = pyv8loader.ThreadProgress(thread, self.delegate)
		prog.on('complete', on_complete)
		prog.on('error', on_error)

	def js(self):
		"Returns JS context"
		if not self._ctx:
			if 'PyV8' not in sys.modules:
				if self.pyv8_state == 'loaded':
					import_pyv8()
				else:
					# Binary is not loaded yet
					return None

			if self._use_unicode is None:
				self._use_unicode = should_use_unicode()

			glue = u'\n' if self._use_unicode else '\n'
			core_src = [self.read_js_file(make_path(f)) for f in self._core_files]
			
			self._ctx = PyV8.JSContext()
			self._ctx.enter()
			self._ctx.eval(glue.join(core_src))

			# load default snippets
			self._ctx.locals.pyLoadSystemSnippets(self.read_js_file(make_path('snippets.json')))

			# expose some methods
			self._ctx.locals.log = js_log
			self._ctx.locals.pyFile = File()

			if self._contrib:
				for k in self._contrib:
					self._ctx.locals[k] = self._contrib[k]

		if self._should_load_extension:
			self._ctx.locals.pyResetUserData()
			self._should_load_extension = False
			self.load_extensions()

		if self._user_data:
			self._ctx.locals.pyLoadUserData(self._user_data)
			self._user_data = None

		return self._ctx

	def load_user_data(self, data):
		"Loads user data payload from JSON"
		self._user_data = data
		# self.js().locals.pyLoadUserData(data)

	def reset(self):
		"Resets JS execution context"
		if self._ctx:
			self._ctx.leave()
			self._ctx = None
			PyV8.JSEngine.collect()
			gc.collect()

		self._should_load_extension = True

	def read_js_file(self, file_path):
		if self._use_unicode:
			f = codecs.open(file_path, 'r', 'utf-8')
		else:
			f = open(file_path, 'r')

		content = f.read()
		f.close()

		return content

	def eval(self, source):
		self.js().eval(source)

	def eval_js_file(self, file_path):
		self.eval(self.read_js_file(file_path))
