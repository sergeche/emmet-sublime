# coding=utf-8
import os
import os.path
import sys
import json
import re
import threading
import subprocess
import tempfile
import collections
import platform
import semver
import time
import zipfile

is_python3 = sys.version_info[0] > 2

if is_python3:
	import urllib.request as url_req
	import urllib.error as url_err
	import urllib.parse as url_parse
else:
	import urllib
	import urllib2
	url_req = urllib2
	url_err = urllib2
	url_parse = urllib2

CHECK_INTERVAL = 60 * 60 * 24

# PACKAGES_URL = 'https://api.github.com/repos/emmetio/pyv8-binaries/downloads'
PACKAGES_URL = 'https://api.github.com/repos/emmetio/pyv8-binaries/contents'

def load(dest_path, delegate=None):
	"""
	Main function that attempts to load or update PyV8 binary.
	First, it loads list of available PyV8 modules and check if
	PyV8 should be downloaded or updated.
	@param dest_path: Path where PyV8 lib should be downloaded 
	@param delegate: instance of LoaderDelegate that will receive
	loader progress events
	@returns: `True` if download progress was initiated
	"""
	if delegate is None:
		delegate = LoaderDelegate()

	config = get_loader_config(dest_path)

	if 'PyV8' in sys.modules and (config['skip_update'] or time.time() < config['last_update'] + CHECK_INTERVAL):
		# No need to load anything: user already has PyV8 binary
		# or decided to disable update process
		delegate.log('No need to update PyV8')
		return False

	def on_complete(result, *args, **kwargs):
		if result is not None:
			# Most recent version was downloaded
			config['last_id'] = result				
			if 'PyV8' not in sys.modules:
				# PyV8 is not loaded yet, we can safely unpack it 
				unpack_pyv8(dest_path)

		config['last_update'] = time.time()
		save_loader_config(dest_path, config)
		delegate.on_complete(*args, **kwargs)

	# try to download most recent version of PyV8
	# As PyV8 for Sublime Text spreads the world, it's possible
	# that multiple distinct PyV8Loader's may start doing the same
	# job at the same time. In this case, we should check if there's
	# already a thread that load PyV8 and hook on existing thread
	# rather that creating a new one
	thread = None
	thread_exists = False
	for t in threading.enumerate():
		if hasattr(t, 'is_pyv8_thread'):
			print('PyV8: Reusing thread')
			thread = t
			thread_exists = True
			break

	if not thread:
		print('PyV8: Creating new thread')
		thread = PyV8Loader(get_arch(), dest_path, config, delegate=delegate)
		thread.start()

	delegate.on_start()
	
	# watch on download progress
	prog = ThreadProgress(thread, delegate, thread_exists)
	prog.on('complete', on_complete if not thread_exists else delegate.on_complete)
	prog.on('error', delegate.on_error)

def get_arch():
	"Returns architecture name for PyV8 binary"
	suffix = is_python3 and '-p3' or ''
	p = lambda a: '%s%s' % (a, suffix)
	is_64bit = sys.maxsize > 2**32
	system_name = platform.system()
	if system_name == 'Darwin':
		try:
			if semver.match(platform.mac_ver()[0], '<10.7.0'):
				return p('mac106')
		except:
			pass

		return p('osx')
	if system_name == 'Windows':
		return p('win64') if is_64bit else p('win32')
	if system_name == 'Linux':
		return p('linux64') if is_64bit else p('linux32')

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

def clean_old_data():
	for f in os.listdir('.'):
		if f.lower() != 'config.json' and f.lower() != 'pack.zip':
			try:
				os.remove(f)
			except Exception as e:
				pass

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

	clean_old_data()

	# Here we don't use .extractall() since it was having issues on OS X
	skip_root_dir = len(root_level_paths) == 1 and \
		root_level_paths[0].endswith('/')
	extracted_paths = []
	for path in package_zip.namelist():
		dest = path

		if not is_python3:
			try:
				if not isinstance(dest, unicode):
					dest = unicode(dest, 'utf-8', 'strict')
			except UnicodeDecodeError:
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

class LoaderDelegate():
	"""
	Abstract class used to display PyV8 binary download progress,
	and provide some settings for downloader
	"""
	def __init__(self, settings={}):
		self.settings = settings

	def on_start(self, *args, **kwargs):
		"Invoked when download process is initiated"
		pass

	def on_progress(self, *args, **kwargs):
		"Invoked on download progress"
		pass

	def on_complete(self, *args, **kwargs):
		"Invoked when download process was finished successfully"
		pass

	def on_error(self, *args, **kwargs):
		"Invoked when error occured during download process"
		pass

	def setting(self, name, default=None):
		"Returns specified setting name"
		return self.settings[name] if name in self.settings else default

	def log(self, message):
		pass

class ThreadProgress():
	def __init__(self, thread, delegate, is_background=False):
		self.thread = thread
		self.delegate = delegate
		self.is_background = is_background
		self._callbacks = {}
		threading.Timer(0, self.run).start()

	def run(self):
		if not self.thread.is_alive():
			if self.thread.exit_code != 0:
				return self.trigger('error', exit_code=self.thread.exit_code, progress=self)
				
			return self.trigger('complete', result=self.thread.result, progress=self)

		self.trigger('progress', progress=self)
		threading.Timer(0.1, self.run).start()

	def on(self, event_name, callback):
		if event_name not in self._callbacks:
			self._callbacks[event_name] = []

		if isinstance(callback, collections.Callable):
			self._callbacks[event_name].append(callback)

		return self

	def trigger(self, event_name, *args, **kwargs):
		if event_name in self._callbacks:
			for c in self._callbacks[event_name]:
				c(*args, **kwargs)

		if self.delegate and hasattr(self.delegate, 'on_%s' % event_name):
			getattr(self.delegate, 'on_%s' % event_name)(*args, **kwargs)

		return self

class BinaryNotFoundError(Exception):
	pass


class NonCleanExitError(Exception):
	def __init__(self, returncode):
		self.returncode = returncode

	def __str__(self):
		return repr(self.returncode)


class CliDownloader():
	def __init__(self, settings):
		self.settings = settings

	def find_binary(self, name):
		for dir in os.environ['PATH'].split(os.pathsep):
			path = os.path.join(dir, name)
			if os.path.exists(path):
				return path

		raise BinaryNotFoundError('The binary %s could not be located' % name)

	def execute(self, args):
		proc = subprocess.Popen(args, stdin=subprocess.PIPE,
			stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

		output = proc.stdout.read()
		returncode = proc.wait()
		if returncode != 0:
			error = NonCleanExitError(returncode)
			error.output = output
			raise error
		return output

class WgetDownloader(CliDownloader):
	def __init__(self, settings):
		self.settings = settings
		self.wget = self.find_binary('wget')

	def clean_tmp_file(self):
		os.remove(self.tmp_file)

	def download(self, url, error_message, timeout, tries):
		if not self.wget:
			return False

		self.tmp_file = tempfile.NamedTemporaryFile().name
		command = [self.wget, '--connect-timeout=' + str(int(timeout)), '-o',
			self.tmp_file, '-O', '-', '-U', 'Emmet PyV8 Loader',
			'--no-check-certificate']

		command.append(url)

		if self.settings.get('http_proxy'):
			os.putenv('http_proxy', self.settings.get('http_proxy'))
			if not self.settings.get('https_proxy'):
				os.putenv('https_proxy', self.settings.get('http_proxy'))
		if self.settings.get('https_proxy'):
			os.putenv('https_proxy', self.settings.get('https_proxy'))

		while tries > 0:
			tries -= 1
			try:
				result = self.execute(command)
				self.clean_tmp_file()
				return result
			except NonCleanExitError as e:
				error_line = ''
				with open(self.tmp_file) as f:
					for line in list(f):
						if re.search('ERROR[: ]|failed: ', line):
							error_line = line
							break

				if e.returncode == 8:
					regex = re.compile('^.*ERROR (\d+):.*', re.S)
					if re.sub(regex, '\\1', error_line) == '503':
						# GitHub and BitBucket seem to rate limit via 503
						print('%s: Downloading %s was rate limited, trying again' % (__name__, url))
						continue
					error_string = 'HTTP error ' + re.sub('^.*? ERROR ', '',
						error_line)

				elif e.returncode == 4:
					error_string = re.sub('^.*?failed: ', '', error_line)
					# GitHub and BitBucket seem to time out a lot
					if error_string.find('timed out') != -1:
						print('%s: Downloading %s timed out, trying again' % (__name__, url))
						continue

				else:
					error_string = re.sub('^.*?(ERROR[: ]|failed: )', '\\1',
						error_line)

				error_string = re.sub('\\.?\s*\n\s*$', '', error_string)
				print('%s: %s %s downloading %s.' % (__name__, error_message,
						error_string, url))
			self.clean_tmp_file()
			break
		return False


class CurlDownloader(CliDownloader):
	def __init__(self, settings):
		self.settings = settings
		self.curl = self.find_binary('curl')

	def download(self, url, error_message, timeout, tries):
		if not self.curl:
			return False
		command = [self.curl, '-f', '--user-agent', 'Emmet PyV8 Loader',
			'--connect-timeout', str(int(timeout)), '-sS']

		command.append(url)

		if self.settings.get('http_proxy'):
			os.putenv('http_proxy', self.settings.get('http_proxy'))
			if not self.settings.get('https_proxy'):
				os.putenv('HTTPS_PROXY', self.settings.get('http_proxy'))
		if self.settings.get('https_proxy'):
			os.putenv('HTTPS_PROXY', self.settings.get('https_proxy'))

		while tries > 0:
			tries -= 1
			try:
				return self.execute(command)
			except NonCleanExitError as e:
				if e.returncode == 22:
					code = re.sub('^.*?(\d+)\s*$', '\\1', e.output)
					if code == '503':
						# GitHub and BitBucket seem to rate limit via 503
						print('%s: Downloading %s was rate limited, trying again' % (__name__, url))
						continue
					error_string = 'HTTP error ' + code
				elif e.returncode == 6:
					error_string = 'URL error host not found'
				elif e.returncode == 28:
					# GitHub and BitBucket seem to time out a lot
					print('%s: Downloading %s timed out, trying again' % (__name__, url))
					continue
				else:
					error_string = e.output.rstrip()

				print('%s: %s %s downloading %s.' % (__name__, error_message, error_string, url))
			break
		return False


class UrlLib2Downloader():
	def __init__(self, settings):
		self.settings = settings

	def download(self, url, error_message, timeout, tries):
		http_proxy = self.settings.get('http_proxy')
		https_proxy = self.settings.get('https_proxy')
		if http_proxy or https_proxy:
			proxies = {}
			if http_proxy:
				proxies['http'] = http_proxy
				if not https_proxy:
					proxies['https'] = http_proxy
			if https_proxy:
				proxies['https'] = https_proxy
			proxy_handler = url_req.ProxyHandler(proxies)
		else:
			proxy_handler = url_req.ProxyHandler()
		handlers = [proxy_handler]

		# secure_url_match = re.match('^https://([^/]+)', url)
		# if secure_url_match != None:
		# 	secure_domain = secure_url_match.group(1)
		# 	bundle_path = self.check_certs(secure_domain, timeout)
		# 	if not bundle_path:
		# 		return False
		# 	handlers.append(VerifiedHTTPSHandler(ca_certs=bundle_path))
		url_req.install_opener(url_req.build_opener(*handlers))

		while tries > 0:
			tries -= 1
			try:
				request = url_req.Request(url, headers={"User-Agent":
					"Emmet PyV8 Loader"})
				http_file = url_req.urlopen(request, timeout=timeout)
				return http_file.read()

			except url_err.HTTPError as e:
				# Bitbucket and Github ratelimit using 503 a decent amount
				if str(e.code) == '503':
					print('%s: Downloading %s was rate limited, trying again' % (__name__, url))
					continue
				print('%s: %s HTTP error %s downloading %s.' % (__name__, error_message, str(e.code), url))

			except url_err.URLError as e:
				# Bitbucket and Github timeout a decent amount
				if str(e.reason) == 'The read operation timed out' or \
						str(e.reason) == 'timed out':
					print('%s: Downloading %s timed out, trying again' % (__name__, url))
					continue
				print('%s: %s URL error %s downloading %s.' % (__name__, error_message, str(e.reason), url))
			break
		return False

class PyV8Loader(threading.Thread):
	def __init__(self, arch, download_path, config, delegate=None):
		self.arch = arch
		self.config = config
		self.download_path = download_path
		self.exit_code = 0
		self.result = None
		self.delegate = delegate or LoaderDelegate()
		self.is_pyv8_thread = True

		threading.Thread.__init__(self)
		self.delegate.log('Creating thread')

	def download_url(self, url, error_message):
		# TODO add settings
		has_ssl = 'ssl' in sys.modules and hasattr(url_req, 'HTTPSHandler')
		is_ssl = re.search('^https://', url) != None

		if (is_ssl and has_ssl) or not is_ssl:
			downloader = UrlLib2Downloader(self.delegate.settings)
		else:
			for downloader_class in [CurlDownloader, WgetDownloader]:
				try:
					downloader = downloader_class(self.delegate.settings)
					break
				except BinaryNotFoundError:
					pass

		if not downloader:
			self.delegate.log('Unable to download PyV8 binary due to invalid downloader')
			return False

		timeout = self.delegate.settings.get('timeout', 60)
		# timeout = 3
		return downloader.download(url.replace(' ', '%20'), error_message, timeout, 3)

	def run(self):
		# get list of available packages first
		self.delegate.log('Loading %s' % PACKAGES_URL)
		try:
			packages = self.download_url(PACKAGES_URL, 'Unable to download packages list.')
		except Exception as e:
			self.delegate.log('Unable to download file: %s' % e)
			self.exit_code = 4
			return

		if not packages:
			self.exit_code = 1
			return

		if isinstance(packages, bytes):
			packages = packages.decode('utf-8')

		files = json.loads(packages)

		# find package for current architecture
		cur_item = None
		bundle_name = 'pyv8-%s.zip' % self.arch
		for item in files:
			if bundle_name == item['name']:
				cur_item = item
				break

		if not cur_item:
			self.delegate.log('Unable to find binary for %s architecture' % self.arch)
			self.exit_code = 2
			return

		if cur_item['sha'] == self.config['last_id']:
			self.delegate.log('You have the most recent PyV8 binary')
			return

		url = 'https://raw.github.com/emmetio/pyv8-binaries/master/%s' % cur_item['name']
		self.delegate.log('Loading PyV8 binary from %s' % url)
		package = self.download_url(url, 'Unable to download package from %s' % url)
		if not package:
			self.exit_code = 3
			return

		# we should only save downloaded package and delegate module
		# loading/unloading to main thread since improper PyV8 unload
		# may cause editor crash
		try:
			os.makedirs(self.download_path)
		except Exception as e:
			pass
		
		fp = open(os.path.join(self.download_path, 'pack.zip'), 'wb')
		fp.write(package)
		fp.close()

		self.result = cur_item['sha']
		# Done!
		
