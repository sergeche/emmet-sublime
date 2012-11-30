# coding=utf-8
import os
import os.path
import sys
import urllib
import urllib2
import json
import re
import threading
import subprocess
import tempfile

PACKAGES_URL = 'https://api.github.com/repos/emmetio/pyv8-binaries/downloads'

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

class ThreadProgress():
	def __init__(self, thread, delegate):
		self.thread = thread
		self.delegate = delegate
		self._callbacks = {}
		threading.Timer(0, self.run).start()

	def run(self):
		if not self.thread.is_alive():
			if self.thread.exit_code != 0:
				return self.trigger('error', exit_code=self.thread.exit_code, thread=self.thread)
				
			return self.trigger('complete', result=self.thread.result, thread=self.thread)

		self.trigger('progress', thread=self.thread)
		threading.Timer(0.1, self.run).start()

	def on(self, event_name, callback):
		if event_name not in self._callbacks:
			self._callbacks[event_name] = []

		if callable(callback):
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
			self.tmp_file, '-O', '-', '-U', 'Emmet PyV8 Loader']

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
			except (NonCleanExitError) as (e):
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
						print ('%s: Downloading %s was rate limited' +
							', trying again') % (__name__, url)
						continue
					error_string = 'HTTP error ' + re.sub('^.*? ERROR ', '',
						error_line)

				elif e.returncode == 4:
					error_string = re.sub('^.*?failed: ', '', error_line)
					# GitHub and BitBucket seem to time out a lot
					if error_string.find('timed out') != -1:
						print ('%s: Downloading %s timed out, ' +
							'trying again') % (__name__, url)
						continue

				else:
					error_string = re.sub('^.*?(ERROR[: ]|failed: )', '\\1',
						error_line)

				error_string = re.sub('\\.?\s*\n\s*$', '', error_string)
				print '%s: %s %s downloading %s.' % (__name__, error_message,
					error_string, url)
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
			except (NonCleanExitError) as (e):
				if e.returncode == 22:
					code = re.sub('^.*?(\d+)\s*$', '\\1', e.output)
					if code == '503':
						# GitHub and BitBucket seem to rate limit via 503
						print ('%s: Downloading %s was rate limited' +
							', trying again') % (__name__, url)
						continue
					error_string = 'HTTP error ' + code
				elif e.returncode == 6:
					error_string = 'URL error host not found'
				elif e.returncode == 28:
					# GitHub and BitBucket seem to time out a lot
					print ('%s: Downloading %s timed out, trying ' +
						'again') % (__name__, url)
					continue
				else:
					error_string = e.output.rstrip()

				print '%s: %s %s downloading %s.' % (__name__, error_message,
					error_string, url)
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
			proxy_handler = urllib2.ProxyHandler(proxies)
		else:
			proxy_handler = urllib2.ProxyHandler()
		handlers = [proxy_handler]

		# secure_url_match = re.match('^https://([^/]+)', url)
		# if secure_url_match != None:
		# 	secure_domain = secure_url_match.group(1)
		# 	bundle_path = self.check_certs(secure_domain, timeout)
		# 	if not bundle_path:
		# 		return False
		# 	handlers.append(VerifiedHTTPSHandler(ca_certs=bundle_path))
		urllib2.install_opener(urllib2.build_opener(*handlers))

		while tries > 0:
			tries -= 1
			try:
				request = urllib2.Request(url, headers={"User-Agent":
					"Emmet PyV8 Loader"})
				http_file = urllib2.urlopen(request, timeout=timeout)
				return http_file.read()

			except (urllib2.HTTPError) as (e):
				# Bitbucket and Github ratelimit using 503 a decent amount
				if str(e.code) == '503':
					print ('%s: Downloading %s was rate limited, ' +
						'trying again') % (__name__, url)
					continue
				print '%s: %s HTTP error %s downloading %s.' % (__name__,
					error_message, str(e.code), url)

			except (urllib2.URLError) as (e):
				# Bitbucket and Github timeout a decent amount
				if str(e.reason) == 'The read operation timed out' or \
						str(e.reason) == 'timed out':
					print ('%s: Downloading %s timed out, trying ' +
						'again') % (__name__, url)
					continue
				print '%s: %s URL error %s downloading %s.' % (__name__,
					error_message, str(e.reason), url)
			break
		return False

class PyV8Loader(threading.Thread):
	def __init__(self, arch, download_path, config):
		self.arch = arch
		self.config = config
		self.download_path = download_path
		self.exit_code = 0
		self.result = None
		self.settings = {}

		threading.Thread.__init__(self)
		self.log('Creating thread')

	def log(self, message):
		print('PyV8 Loader: %s' % message)

	def download_url(self, url, error_message):
		# TODO add settings
		has_ssl = 'ssl' in sys.modules and hasattr(urllib2, 'HTTPSHandler')
		is_ssl = re.search('^https://', url) != None

		if (is_ssl and has_ssl) or not is_ssl:
			downloader = UrlLib2Downloader(self.settings)
		else:
			for downloader_class in [CurlDownloader, WgetDownloader]:
				try:
					downloader = downloader_class(self.settings)
					break
				except (BinaryNotFoundError):
					pass

		if not downloader:
			self.log('Unable to download PyV8 binary due to invalid downloader')
			return False

		# timeout = self.settings.get('timeout', 3)
		timeout = 3
		return downloader.download(url.replace(' ', '%20'), error_message, timeout, 3)

	def run(self):
		# get list of available packages first
		packages = self.download_url(PACKAGES_URL, 'Unable to download packages list.')

		if not packages:
			self.exit_code = 1
			return

		files = json.loads(packages)

		# find package for current architecture
		cur_item = None
		for item in files:
			if self.arch in item['name']:
				cur_item = item
				break

		if not cur_item:
			self.log('Unable to find binary for %s architecture' % self.arch)
			self.exit_code = 2
			return

		if cur_item['id'] == self.config['last_id']:
			self.log('You have the most recent PyV8 binary')
			return

		# Reduce HTTP roundtrips: try to download binary from 
		# http://cloud.github.com directly
		url = re.sub(r'^https?:\/\/github\.com', 'http://cloud.github.com', item['html_url'])
		self.log('Loading PyV8 binary from %s' % url)
		package = self.download_url(url, 'Unable to download package from %s' % url)
		if not package:
			url = item['html_url']
			self.log('Loading PyV8 binary from %s' % url)
			package = self.download_url(url, 'Unable to download package from %s' % url)
			if not package:
				self.exit_code = 3
				return

		# we should only save downloaded package and delegate module
		# loading/unloading to main thread since improper PyV8 unload
		# may cause editor crash
		
		try:
			os.makedirs(self.download_path)
		except Exception, e:
			pass
		
		fp = open(os.path.join(self.download_path, 'pack.zip'), 'wb')
		fp.write(package)
		fp.close()

		self.result = cur_item['id']
		# Done!
		
