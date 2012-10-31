# coding=utf-8
import sublime
import sublime_plugin
import os
import os.path
import sys
import urllib
import urllib2
import json
import re
import threading

# PACKAGES_URL = 'https://api.github.com/repos/sergeche/zen-coding/downloads'
PACKAGES_URL = 'http://localhost:8103/dw.json'

class ThreadProgress():
	def __init__(self, thread, message, on_complete=None, on_error=None):
		self.thread = thread
		self.message = message
		self.addend = 1
		self.size = 8
		self.on_complete = on_complete
		self.on_error = on_error
		sublime.set_timeout(lambda: self.run(0), 100)

	def run(self, i):
		if not self.thread.is_alive():
			if hasattr(self.thread, 'exit_code') and self.thread.exit_code != 0:
				if callable(self.on_error):
					self.on_error(self.thread.exit_code)
				return
			if callable(self.on_complete):
				self.on_complete(self.thread.result)
			return

		before = i % self.size
		after = (self.size - 1) - before
		sublime.status_message('%s [%s=%s]' % \
			(self.message, ' ' * before, ' ' * after))
		if not after:
			self.addend = -1
		if not before:
			self.addend = 1
		i += self.addend
		sublime.set_timeout(lambda: self.run(i), 100)

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
	def __init__(self, arch, download_path, last_id=0):
		self.arch = arch
		self.exit_code = 0
		self.result = None
		self.last_id = last_id
		self.download_path = download_path
		# TODO add settings
		self.settings = {}
		threading.Thread.__init__(self)

	def download_url(self, url, error_message):
		downloader = UrlLib2Downloader(self.settings)

		if not downloader:
			print('Unable to download PyV8 binary due to invalid downloader')
			return False

		timeout = self.settings.get('timeout', 3)
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
			if self.arch in item['description'].lower():
				cur_item = item
				break

		if not cur_item:
			print('Unable to find binary for %s architecture' % self.arch)
			self.exit_code = 2
			return

		if cur_item['id'] == self.last_id:
			print('You have the most recent PyV8 binary')
			return

		print('Loading PyV8 binary from %s' % item['html_url'])
		package = self.download_url(item['html_url'], 'Unable to download package from %s' % item['html_url'])
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
		
