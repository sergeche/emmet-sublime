import sys
import os
import os.path
import platform
import codecs
import json
from file import File

SUPPORTED_PLATFORMS = {
	"Darwin": "PyV8/osx",
	"Linux": "PyV8/linux",
	"Linux64": "PyV8/linux64",
	"Windows": "PyV8/win32",
	"Windows64": "PyV8/win64"
}

BASE_PATH = os.path.abspath(os.path.dirname(__file__))

def cross_platform():
	is_64bit = sys.maxsize > 2**32
	system_name = platform.system()
	if system_name == 'Windows' and is_64bit:
		system_name = 'Windows64'
	if system_name == 'Linux' and is_64bit:
		system_name = 'Linux64'

	platform_supported = SUPPORTED_PLATFORMS.get(system_name)
	if not platform_supported:
		raise Exception, '''
			Sorry, the v8 engine for this platform are not built yet. 
			Maybe you need to build v8 follow the guide of lib/PyV8/README.md. 
		'''
	lib_path = os.path.join(BASE_PATH, platform_supported)
	if not lib_path in sys.path:
		sys.path.append(lib_path)
		sys.path.append(BASE_PATH)

cross_platform()

try:
	import PyV8
except Exception, e:
	raise Exception, '''
		Sorry, the v8 engine are not built correctlly.
		Maybe you need to build v8 follow the guide of lib/PyV8/README.md. 
	''' 

core_files = ['zencoding-app.js', 'python-wrapper.js']

def should_use_unicode():
	"""
	WinXP unable to eval JS in unicode object (while other OSes requires is)
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

class Context():
	"""
	Creates Emmet JS core context
	@param files: Additional files to load with JS core
	@param path: Path to Emmet extensions
	@param contrib: Python objects to contribute to JS execution context
	"""
	def __init__(self, files=[], path=None, contrib=None):
		self._ctx = None
		self._contrib = contrib

		# detect reader encoding
		self._use_unicode = should_use_unicode()
		self._core_files = [] + core_files + files

		self._ext_path = None
		self.set_ext_path(path)

		
	def get_ext_path(self):
		return self._ext_path

	def set_ext_path(self, val):
		val = os.path.abspath(os.path.expanduser(val)) if val else None

		if val == self._ext_path:
			return

		self.reset()

		self._ext_path = val
		if os.path.isdir(self._ext_path):
			# load extensions
			ext_files = []
			print('Loading Emmet extensions from %s' % self._ext_path)
			for dirname, dirnames, filenames in os.walk(self._ext_path):
				for filename in filenames:
					ext_files.append(os.path.join(dirname, filename))

			self.js().locals.pyLoadExtensions(ext_files)

	def js(self):
		"Returns JS context"
		if not self._ctx:
			glue = u'\n' if self._use_unicode else '\n'
			core_src = [self.read_js_file(make_path(f)) for f in self._core_files]
			
			self._ctx = PyV8.JSContext()
			self._ctx.enter()
			self._ctx.eval(glue.join(core_src))

			self._ctx.locals.pyResetUserData()

			# load default snippets
			self._ctx.locals.pyLoadSystemSnippets(self.read_js_file(make_path('snippets.json')))

			# expose some methods
			self._ctx.locals.log = js_log
			self._ctx.locals.pyFile = File()

			if self._contrib:
				for k in self._contrib:
					self._ctx.locals[k] = self._contrib[k]

		return self._ctx

	def load_user_data(self, data):
		"Loads user data payload from JSON"
		self.js().locals.pyLoadUserData(data)

	def reset(self):
		"Resets JS execution context"
		if self._ctx:
			self._ctx.leave()
			self._ctx = None

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
