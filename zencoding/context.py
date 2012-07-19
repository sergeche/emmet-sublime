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
	"Windows": "PyV8/win32",
	"Windows64": "PyV8/win64"
}

def cross_platform():
	base_path = os.path.abspath(os.path.dirname(__file__))
	is_64bit = sys.maxsize > 2**32
	system_name = platform.system()
	if system_name == 'Windows' and is_64bit:
		system_name = 'Windows64'

	platform_supported = SUPPORTED_PLATFORMS.get(system_name)
	if not platform_supported:
		raise Exception, '''
			Sorry, the v8 engine for this platform are not built yet. 
			Maybe you need to build v8 follow the guide of lib/PyV8/README.md. 
		'''
	lib_path = os.path.join(base_path, platform_supported)
	if not lib_path in sys.path:
		sys.path.append(lib_path)
		sys.path.append(base_path)

cross_platform()

try:
	import PyV8
except Exception, e:
	raise Exception, '''
		Sorry, the v8 engine are not built correctlly.
		Maybe you need to build v8 follow the guide of lib/PyV8/README.md. 
	''' 

core_files = ['zencoding.js', 'python-wrapper.js']

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
	base = os.path.abspath(os.path.dirname(__file__))
	return os.path.normpath(os.path.join(base, filename))

def js_log(message):
	print(message)

class Context():
	"""
	Creates Zen Coding JS core context
	@param files: Additional files to load with JS core
	@param ext_path: Path to Zen Coding extensions
	"""
	def __init__(self, files=[], ext_path=None):
		self._ctx = None

		# detect reader encoding
		# self._use_unicode = should_use_unicode()
		self._use_unicode = False
		glue = u'\n' if self._use_unicode else '\n'
		
		# create reusable extensions so we can easily reload JS context
		files_to_load = [] + core_files + files
		core_src = [self.read_js_file(make_path(f)) for f in files_to_load]
		self._core_ext = PyV8.JSExtension('core/javascript', glue.join(core_src))
		self._addon_ext = None

		self.ext_path = os.path.abspath(os.path.expanduser(ext_path)) if ext_path else None
		self._ext_snippets = {}
		self._ext_prefs = {}

		if self.ext_path:
			self._load_extensions(self.ext_path)
		

	def _load_extensions(self, path):
		ext_src = []
		glue = u'\n' if self._use_unicode else '\n'

		print('Loading Zen Coding extensions from %s' % path)

		for dirname, dirnames, filenames in os.walk(path):
			for filename in filenames:
				abspath = os.path.join(dirname, filename)
				filename = filename.lower()
				name, ext = os.path.splitext(filename)

				if ext == '.js':
					ext_src.append(self.read_js_file(abspath))
				elif filename == 'snippets.json':
					self._ext_snippets = json.loads(self.read_js_file(abspath))
				elif filename == 'preferences.json':
					self._ext_prefs = json.loads(self.read_js_file(abspath))

		if ext_src:
			self._addon_ext = PyV8.JSExtension('addon/javascript', glue.join(ext_src))

	def js(self):
		"Returns JS context"
		if not self._ctx:
			ext = ['core/javascript']
			if self._addon_ext:
				ext.append('addon/javascript')

			self._ctx = PyV8.JSContext(extensions=ext)
			self._ctx.enter()

			# expose some methods
			self._ctx.locals.log = js_log
			self._ctx.locals.pyFile = File()

			self.set_snippets(self._ext_snippets)
			self.set_snippets(self._ext_prefs)

		return self._ctx

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

	def set_snippets(self, snippets={}):
		self.js().locals.pySetUserSnippets(self._ext_snippets, snippets)

	def set_preferences(self, prefs={}):
		self.js().locals.pySetUserPreferences(self._ext_prefs, prefs)
